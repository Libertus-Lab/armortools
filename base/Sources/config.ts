
let config_raw: config_t = null;
let config_keymap: map_t<string, string>;
let config_loaded: bool = false;
let config_button_align: zui_align_t = zui_align_t.LEFT;
let config_default_button_spacing: string = "       ";
let config_button_spacing: string = config_default_button_spacing;

function config_load(done: ()=>void) {
	let path: string = "";
	if (path_is_protected()) {
		path += krom_save_path();
	}
	path += "config.json";
	let blob: buffer_t = data_get_blob(path);

	///if krom_linux
	if (blob == null) { // Protected directory
		blob = data_get_blob(krom_save_path() + "config.json");
	}
	///end

	if (blob != null) {
		config_loaded = true;
		config_raw = json_parse(sys_buffer_to_string(blob));
	}

	done();
}

function config_save() {
	// Use system application data folder
	// when running from protected path like "Program Files"
	let path: string = "";
	if (path_is_protected()) {
		path += krom_save_path();
	}
	else {
		path += path_data();
		path += path_sep;
	}
	path += "config.json";

	let buffer: buffer_t = sys_string_to_buffer(json_stringify(config_raw));
	krom_file_save_bytes(path, buffer, 0);

	///if krom_linux // Protected directory
	if (!file_exists(path)) {
		krom_file_save_bytes(krom_save_path() + "config.json", buffer, 0);
	}
	///end
}

function config_init() {
	if (!config_loaded || config_raw == null) {
		config_raw = {};
		config_raw.locale = "system";
		config_raw.window_mode = 0;
		config_raw.window_resizable = true;
		config_raw.window_minimizable = true;
		config_raw.window_maximizable = true;
		config_raw.window_w = 1600;
		config_raw.window_h = 900;
		///if krom_darwin
		config_raw.window_w *= 2;
		config_raw.window_h *= 2;
		///end
		config_raw.window_x = -1;
		config_raw.window_y = -1;
		config_raw.window_scale = 1.0;
		if (sys_display_width() >= 2560 && sys_display_height() >= 1600) {
			config_raw.window_scale = 2.0;
		}
		///if (krom_android || krom_ios || krom_darwin)
		config_raw.window_scale = 2.0;
		///end
		config_raw.window_vsync = true;
		config_raw.window_frequency = sys_display_frequency();
		config_raw.rp_bloom = false;
		config_raw.rp_gi = false;
		config_raw.rp_vignette = 0.2;
		config_raw.rp_grain = 0.09;
		config_raw.rp_motionblur = false;
		///if (krom_android || krom_ios)
		config_raw.rp_ssao = false;
		///else
		config_raw.rp_ssao = true;
		///end
		config_raw.rp_ssr = false;
		config_raw.rp_supersample = 1.0;
		config_raw.version = manifest_version;
		config_raw.sha = config_get_sha();
		base_init_config();
	}
	else {
		// Upgrade config format created by older ArmorPaint build
		// if (config_raw.version != manifest_version) {
		// 	config_raw.version = manifest_version;
		// 	save();
		// }
		if (config_raw.sha != config_get_sha()) {
			config_loaded = false;
			config_init();
			return;
		}
	}

	zui_touch_scroll = config_raw.touch_ui;
	zui_touch_hold = config_raw.touch_ui;
	zui_touch_tooltip = config_raw.touch_ui;
	base_res_handle.position = config_raw.layer_res;
	config_load_keymap();
}

type version_t = {
	sha: string;
	date: string;
};

function config_get_sha(): string {
	let sha: string = "";
	let blob: buffer_t = data_get_blob("version.json");
	let v: version_t = json_parse(sys_buffer_to_string(blob));
	return v.sha;
}

function config_get_date(): string {
	let date: string = "";
	let blob: buffer_t = data_get_blob("version.json");
	let v: version_t = json_parse(sys_buffer_to_string(blob));
	return v.date;
}

function config_get_options(): kinc_sys_ops_t {
	let window_mode: window_mode_t = config_raw.window_mode == 0 ? window_mode_t.WINDOWED : window_mode_t.FULLSCREEN;
	let window_features: window_features_t = window_features_t.NONE;
	if (config_raw.window_resizable) {
		window_features |= window_features_t.RESIZABLE;
	}
	if (config_raw.window_maximizable) {
		window_features |= window_features_t.MAXIMIZABLE;
	}
	if (config_raw.window_minimizable) {
		window_features |= window_features_t.MINIMIZABLE;
	}
	let title: string = "untitled - " + manifest_title;
	let ops: kinc_sys_ops_t = {
		title: title,
		width: config_raw.window_w,
		height: config_raw.window_h,
		x: config_raw.window_x,
		y: config_raw.window_y,
		mode: window_mode,
		features: window_features,
		vsync: config_raw.window_vsync,
		frequency: config_raw.window_frequency
	};
	return ops;
}

function config_restore() {
	zui_children = map_create(); // Reset ui handles
	config_loaded = false;
	let _layout: i32[] = config_raw.layout;
	config_init();
	config_raw.layout = _layout;
	base_init_layout();
	translator_load_translations(config_raw.locale);
	config_apply();
	config_load_theme(config_raw.theme);
}

function config_import_from(from: config_t) {
	let _sha: string = config_raw.sha;
	let _version: string = config_raw.version;
	config_raw = from;
	config_raw.sha = _sha;
	config_raw.version = _version;
	zui_children = map_create(); // Reset ui handles
	config_load_keymap();
	base_init_layout();
	translator_load_translations(config_raw.locale);
	config_apply();
	config_load_theme(config_raw.theme);
}

function config_apply() {
	config_raw.rp_ssao = context_raw.hssao.selected;
	config_raw.rp_ssr = context_raw.hssr.selected;
	config_raw.rp_bloom = context_raw.hbloom.selected;
	config_raw.rp_gi = context_raw.hvxao.selected;
	config_raw.rp_supersample = config_get_super_sample_size(context_raw.hsupersample.position);
	config_save();
	context_raw.ddirty = 2;

	let current: image_t = _g2_current;
	let g2_in_use: bool = _g2_in_use;
	if (g2_in_use) g2_end();
	render_path_base_apply_config();
	if (g2_in_use) g2_begin(current);
}

function config_load_keymap() {
	config_keymap = base_get_default_keymap();
	if (config_raw.keymap != "default.json") {
		let blob: buffer_t = data_get_blob("keymap_presets/" + config_raw.keymap);
		let new_keymap: map_t<string, string> = json_parse_to_map(sys_buffer_to_string(blob));
		let keys: string[] = map_keys(new_keymap);
		for (let i: i32 = 0; i < keys.length; ++i) {
			let key: string = keys[i];
			map_set(config_keymap, key, map_get(new_keymap, key));
		}
	}
}

function config_save_keymap() {
	if (config_raw.keymap == "default.json") {
		return;
	}
	let path: string = data_path() + "keymap_presets/" + config_raw.keymap;
	let buffer: buffer_t = sys_string_to_buffer(json_stringify(config_keymap));
	krom_file_save_bytes(path, buffer, 0);
}

function config_get_super_sample_quality(f: f32): i32 {
	return f == 0.25 ? 0 :
		   f == 0.5 ? 1 :
		   f == 1.0 ? 2 :
		   f == 1.5 ? 3 :
		   f == 2.0 ? 4 : 5;
}

function config_get_super_sample_size(i: i32): f32 {
	return i == 0 ? 0.25 :
		   i == 1 ? 0.5 :
		   i == 2 ? 1.0 :
		   i == 3 ? 1.5 :
		   i == 4 ? 2.0 : 4.0;
}

function config_get_texture_res(): i32 {
	let res: i32 = base_res_handle.position;
	return res == texture_res_t.RES128 ? 128 :
		   res == texture_res_t.RES256 ? 256 :
		   res == texture_res_t.RES512 ? 512 :
		   res == texture_res_t.RES1024 ? 1024 :
		   res == texture_res_t.RES2048 ? 2048 :
		   res == texture_res_t.RES4096 ? 4096 :
		   res == texture_res_t.RES8192 ? 8192 :
		   res == texture_res_t.RES16384 ? 16384 : 0;
}

function config_get_texture_res_x(): i32 {
	return context_raw.project_aspect_ratio == 2 ? math_floor(config_get_texture_res() / 2) : config_get_texture_res();
}

function config_get_texture_res_y(): i32 {
	return context_raw.project_aspect_ratio == 1 ? math_floor(config_get_texture_res() / 2) : config_get_texture_res();
}

function config_get_texture_res_pos(i: i32): i32 {
	return i == 128 ? texture_res_t.RES128 :
		   i == 256 ? texture_res_t.RES256 :
		   i == 512 ? texture_res_t.RES512 :
		   i == 1024 ? texture_res_t.RES1024 :
		   i == 2048 ? texture_res_t.RES2048 :
		   i == 4096 ? texture_res_t.RES4096 :
		   i == 8192 ? texture_res_t.RES8192 :
		   i == 16384 ? texture_res_t.RES16384 : 0;
}

function config_load_theme(theme: string, tag_redraw: bool = true) {
	base_theme = zui_theme_create();

	if (theme != "default.json") {
		let b: buffer_t = data_get_blob("themes/" + theme);
		let parsed: any = json_parse(sys_buffer_to_string(b));
		for (let i: i32 = 0; i < zui_theme_keys.length; ++i) {
			let key: string = zui_theme_keys[i];
			// @ts-ignore
			// base_theme[key] = parsed[key]; ////
		}
	}

	base_theme.FILL_WINDOW_BG = true;

	if (tag_redraw) {
		for (let i: i32 = 0; i < base_get_uis().length; ++i) {
			let ui: zui_t = base_get_uis()[i];

			// ui.ops.theme = base_theme;

			for (let i: i32 = 0; i < zui_theme_keys.length; ++i) {
				let key: string = zui_theme_keys[i];
				// @ts-ignore
				// ui.ops.theme[key] = base_theme[key]; ////
			}
			base_theme = ui.ops.theme;

		}
		ui_base_tag_ui_redraw();
	}

	if (config_raw.touch_ui) {
		// Enlarge elements
		base_theme.FULL_TABS = true;
		base_theme.ELEMENT_H = 24 + 6;
		base_theme.BUTTON_H = 22 + 6;
		base_theme.FONT_SIZE = 13 + 2;
		base_theme.ARROW_SIZE = 5 + 2;
		base_theme.CHECK_SIZE = 15 + 4;
		base_theme.CHECK_SELECT_SIZE = 8 + 2;
		config_button_align = zui_align_t.LEFT;
		config_button_spacing = "";
	}
	else {
		base_theme.FULL_TABS = false;
		config_button_align = zui_align_t.LEFT;
		config_button_spacing = config_default_button_spacing;
	}
}

function config_enable_plugin(f: string) {
	array_push(config_raw.plugins, f);
	plugin_start(f);
}

function config_disable_plugin(f: string) {
	array_remove(config_raw.plugins, f);
	plugin_stop(f);
}

type config_t = {
	// The locale should be specified in ISO 639-1 format: https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes
	// "system" is a special case that will use the system locale
	locale?: string;
	// Window
	window_mode?: i32; // window, fullscreen
	window_w?: i32;
	window_h?: i32;
	window_x?: i32;
	window_y?: i32;
	window_resizable?: bool;
	window_maximizable?: bool;
	window_minimizable?: bool;
	window_vsync?: bool;
	window_frequency?: i32;
	window_scale?: f32;
	// Render path
	rp_supersample?: f32;
	rp_ssao?: bool;
	rp_ssr?: bool;
	rp_bloom?: bool;
	rp_motionblur?: bool;
	rp_gi?: bool;
	rp_vignette?: f32;
	rp_grain?: f32;
	// Application
	version?: string;
	sha?: string; // Commit id
	recent_projects?: string[]; // Recently opened projects
	bookmarks?: string[]; // Bookmarked folders in browser
	plugins?: string[]; // List of enabled plugins
	keymap?: string; // Link to keymap file
	theme?: string; // Link to theme file
	undo_steps?: i32; // Number of undo steps to preserve
	camera_pan_speed?: f32;
	camera_zoom_speed?: f32;
	camera_rotation_speed?: f32;
	zoom_direction?: i32;
	wrap_mouse?: bool;
	show_asset_names?: bool;
	touch_ui?: bool;
	splash_screen?: bool;
	layout?: i32[]; // Sizes
	layout_tabs?: i32[]; // Active tabs
	workspace?: i32;
	camera_controls?: i32; // Orbit, rotate
	server?: string;

	pressure_radius?: bool; // Pen pressure controls
	pressure_sensitivity?: f32;
	displace_strength?: f32;
	layer_res?: i32;
	brush_live?: bool;
	brush_3d?: bool;
	node_preview?: bool;

	pressure_hardness?: bool;
	pressure_angle?: bool;
	pressure_opacity?: bool;
	material_live?: bool;
	brush_depth_reject?: bool;
	brush_angle_reject?: bool;

	dilate?: i32;
	dilate_radius?: i32;

	///if is_lab
	gpu_inference?: bool;
	///end
};

// let config_keys: string[] = [
// 	"locale",
// 	"window_mode",
// 	"window_w",
// 	"window_h",
// 	"window_x",
// 	"window_y",
// 	"window_resizable",
// 	"window_maximizable",
// 	"window_minimizable",
// 	"window_vsync",
// 	"window_frequency",
// 	"window_scale",
// 	"rp_supersample",
// 	"rp_ssao",
// 	"rp_ssr",
// 	"rp_bloom",
// 	"rp_motionblur",
// 	"rp_gi",
// 	"rp_vignette",
// 	"rp_grain",
// 	"version",
// 	"sha",
// 	"recent_projects",
// 	"bookmarks",
// 	"plugins",
// 	"keymap",
// 	"theme",
// 	"undo_steps",
// 	"camera_pan_speed",
// 	"camera_zoom_speed",
// 	"camera_rotation_speed",
// 	"zoom_direction",
// 	"wrap_mouse",
// 	"show_asset_names",
// 	"touch_ui",
// 	"splash_screen",
// 	"layout",
// 	"layout_tabs",
// 	"workspace",
// 	"camera_controls",
// 	"server",
// 	"pressure_radius",
// 	"pressure_sensitivity",
// 	"displace_strength",
// 	"layer_res",
// 	"brush_live",
// 	"brush_3d",
// 	"node_preview",
// 	"pressure_hardness",
// 	"pressure_angle",
// 	"pressure_opacity",
// 	"material_live",
// 	"brush_depth_reject",
// 	"brush_angle_reject",
// 	"dilate",
// 	"dilate_radius",
// 	"gpu_inference",
// ];
