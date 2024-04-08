
type integer_node_t = {
	base?: logic_node_t;
	value?: i32;
};

function integer_node_create(arg: i32): integer_node_t {
	let n: float_node_t = {};
	n.base = logic_node_create();
	n.base.get = integer_node_get;
	n.base.set = integer_node_set;
	n.value = arg;
	return n;
}

function integer_node_get(self: integer_node_t, from: i32): logic_node_value_t {
	if (self.base.inputs.length > 0) {
		return logic_node_input_get(self.base.inputs[0]);
	}
	else {
		let v: logic_node_value_t = { _f32: self.value };
		return v;
	}
}

function integer_node_set(self: integer_node_t, value: any) {
	if (self.base.inputs.length > 0) {
		logic_node_input_set(self.base.inputs[0], value);
	}
	else {
		self.value = value;
	}
}