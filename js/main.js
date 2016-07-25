;(function(){

	"use strict"

	var camera, scene, renderer, light, puckMesh, netMesh
	var world, puckBody, netBody, iceBody, cannonDebugRenderer
	var camDist = 30.0, camHeight = 2.0, camRot = Math.PI / 2.0
	var prevT = Date.now()
	var keyStates = {
		left: false, right: false, up: false, down: false
	}
	var puckCfg = {startX: 0.0, startY: 1.0, startZ: camDist * 0.75, radius: 0.2, height: 0.075, segs: 16}
	var netCfg = {width: 6.0, height: 3.0, depth: 0.25}

	initScene()
	initWorld()
	initUI()
	dropPuck()
	loop()

	window.onkeydown = function(e) {setKeyState(e.keyCode, true)}
	window.onkeyup = function(e) {setKeyState(e.keyCode, false)}

	function initScene() {
		scene = new THREE.Scene()
		camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 1, 100.0)
		camera.position.y = camHeight
		camera.position.z = camDist
		camera.rotation.order = 'YXZ'
		camera.rotation.x = -Math.PI / 20.0
		scene.add(camera)
		light = new THREE.DirectionalLight({color: 0xFFFFFF})
		light.position.set(0.7, 0.7, 0.7)
		scene.add(light)
		scene.add(new THREE.AmbientLight(0x333333))

		// Net Box
		netMesh = new THREE.Mesh(
			new THREE.CubeGeometry(netCfg.width, netCfg.height, netCfg.depth),
			new THREE.MeshLambertMaterial({color: 0xCCCCCC})
		)
		netMesh.position.y = netCfg.height / 2.0
		scene.add(netMesh)

		// Puck cylinder
		puckMesh = new THREE.Mesh(
			new THREE.CylinderGeometry(
				puckCfg.radius, puckCfg.radius, puckCfg.height, puckCfg.segs
			).rotateX(Math.PI * 0.5),
			new THREE.MeshLambertMaterial({color: 0x444444})
		)
		scene.add(puckMesh)

		// Ice (ground plane)
		scene.add(new THREE.Mesh(
			new THREE.PlaneBufferGeometry(camDist * 2.5, camDist * 2.5).rotateX(-Math.PI / 2.0),
			new THREE.MeshLambertMaterial({color: 0x888888})
		))

		renderer = new THREE.WebGLRenderer()
		renderer.setSize(window.innerWidth, window.innerHeight)
		document.body.appendChild(renderer.domElement)
	}

	function initWorld() {
		world = new CANNON.World()
		world.gravity.set(0.0, -10.0, 0.0)
		world.broadphase = new CANNON.SAPBroadphase(world)
		world.defaultContactMaterial.friction = 0.0001
		world.defaultContactMaterial.restitution = 0.01
		world.defaultContactMaterial.contactEquationStiffness = 1000000.0
		world.defaultContactMaterial.frictionEquationStiffness = 100000.0

		// Ice plane
		iceBody = new CANNON.Body({mass: 0})
		iceBody.addShape(new CANNON.Plane())
		iceBody.quaternion.setFromEuler(-Math.PI / 2.0, 0.0, 0.0)
		world.add(iceBody)

		// Puck cylinder
		puckBody = new CANNON.Body({mass: 2.0})
		puckBody.addShape(new CANNON.Cylinder(
			puckCfg.radius, puckCfg.radius, puckCfg.height, puckCfg.segs
		))
		puckBody.material = new CANNON.Material('puck')
		world.add(puckBody)

		// Net box
		netBody = new CANNON.Body({mass: 0})
		netBody.addShape(
			new CANNON.Box(
				new CANNON.Vec3(netCfg.width/2, netCfg.height/2, netCfg.depth/2)
			)
		)
		netBody.position.set(0, netCfg.height/2, 0)
		netBody.quaternion.setFromEuler(Math.PI / 60.0, 0, 0)
		netBody.material = new CANNON.Material('net')
		world.add(netBody)
		// apply this to net mesh
		netMesh.position.set(
			netBody.position.x, netBody.position.y, netBody.position.z
		)
		netMesh.quaternion.set(
			netBody.quaternion.x, netBody.quaternion.y, netBody.quaternion.z, netBody.quaternion.w
		)

		// Catch collide events
		netBody.addEventListener('collide', function(info) {
			log('collide event')
		})

		// Catch endContact events
		netBody.addEventListener('endContact', function(info) {
			log('endContact event')
		})

		var mat = new CANNON.ContactMaterial(
			puckBody.material, netBody.material,
			{
				friction: 10.0,
				restitution: 0.0,
				//contactEquationStiffness: 1e7,
				contactEquationRelaxation: 100.0
				//frictionEquationStiffness: 1
				//frictionEquationRegularizationTime: 3
			}
		)
		world.addContactMaterial(mat)

		cannonDebugRenderer = new THREE.CannonDebugRenderer(scene, world)
	}

	function initUI() {
		var el = document.createElement('div')
		el.className = 'instruct'
		el.textContent = 'S - shoot puck | R - reset puck | L/R arrows - rotate camera'
		document.body.appendChild(el)

		el = document.createElement('div')
		el.id = 'log'
		el.className = 'log'
		document.body.appendChild(el)
	}

	function log(s) {
		console.log(s)
		var el = document.getElementById('log')
		s = el.innerHTML + s + '<br/>'
		el.innerHTML = s
	}

	function setKeyState(code, state) {
		if (state) {
			if (code === 82) {
				dropPuck()
			} else if (code === 32 || code === 83) {
				shootPuck()
			}
		}
		if (code === 37) {
			keyStates.left = state
		} else if (code === 39) {
			keyStates.right = state
		}
	}

	function dropPuck() {
		puckBody.position.set(puckCfg.startX, puckCfg.startY, puckCfg.startZ)
		puckBody.velocity.set(0.0, 0.0, 0.0)
		puckBody.angularVelocity.set(0.0, 0.0, 0.0)
		puckBody.quaternion.setFromEuler(Math.PI * 0.5, 0.0, 0.0)
	}

	function shootPuck() {
		puckBody.velocity.set(
			Math.random() * 10.0 - 5.0,
			Math.random() * 5.0 + 2.0,
			-(Math.random() * 20.0 + 40.0)
		)
	}

	function loop() {
		update()
		render()
		requestAnimationFrame(loop)
	}

	function update() {
		var t = Date.now()
		var dt = t - prevT
		if (dt <= 0) {
			return
		}
		if (dt > 100) {
			prevT = t - 100
			dt = 100
		}
		var ft = dt / 1000.0

		// Use small time steps because puck travels fast.
		var maxStep = 0.005
		var numSteps = Math.max(Math.ceil(ft / maxStep), 1)
		var st = ft / numSteps
		for (var i = 0; i < numSteps; ++i) {
			world.step(st)
		}

		// apply body positions & orientations to meshes
		puckMesh.position.set(
			puckBody.position.x, puckBody.position.y, puckBody.position.z
		)
		puckMesh.quaternion.set(
			puckBody.quaternion.x, puckBody.quaternion.y, puckBody.quaternion.z, puckBody.quaternion.w
		)

		// move camera
		if (keyStates.left) {
			camRot += ft
		} else if (keyStates.right) {
			camRot -= ft
		}
		camera.position.x = Math.cos(camRot) * camDist
		camera.position.z = Math.sin(camRot) * camDist
		camera.rotation.y = Math.PI / 2.0 - camRot

		prevT = t
	}

	function render() {
		cannonDebugRenderer.update()
		renderer.render(scene, camera)
	}

}());
