package arm;

class OrbitCamera extends iron.Trait {

	public static var inst:OrbitCamera;
	public var enabled = false;

	public function new() {
		super();
		inst = this;
		
		notifyOnUpdate(function() {
			if (iron.system.Input.occupied) return;
			if (!arm.App.uienabled) return;
			if (UITrait.inst.isScrolling) return;
			if (arm.App.isDragging) return;
			if (UITrait.inst.cameraType != 0) return;

			var mouse = iron.system.Input.getMouse();
			if (mouse.x > iron.App.w()) return;
			
			var keyboard = iron.system.Input.getKeyboard();
			var camera = iron.Scene.active.camera;

			if (mouse.wheelDelta != 0) {
				UITrait.inst.dirty = true;
				camera.move(camera.look(), mouse.wheelDelta * (-0.1));
			}

			if (mouse.down("middle") || (mouse.down("right") && keyboard.down("space"))) {
				UITrait.inst.dirty = true;
				camera.transform.loc.addf(-mouse.movementX / 150, 0.0, mouse.movementY / 150);
				camera.buildMatrix();
			}
		});
	}
}
