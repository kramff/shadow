"use strict";
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

console.log("Shadow game");


let showDebug = true;
let currentFrameSpan;
let rollbacksSpan;
let resimulatedFramesSpan;
let largestRemoteLagSpan;

let gameStatusMessageSpan;
let team1ScoreSpan;
let team2ScoreSpan;

let inputDelay = 3;

// Main render stuff
let scene;
let camera;
let renderer;

let xCamera = 0;
let yCamera = 0;
let zCamera = 10;

// Specific render stuff
let cubeGeometry;
let playerMaterial;
let playerTeam1Material;
let playerTeam1DefeatedMaterial;
let playerTeam2Material;
let playerTeam2DefeatedMaterial;

let planeGeometry;
let floorMaterial;
let floorMesh;

let wallMaterial;
let wallMaterialHighlight;

let tableMaterial;
let tableMaterialHighlight;

let supplyMaterial;
let supplyMaterialHighlight;

let sphereGeometry;
let itemMaterial;
let itemMaterial2;
// let itemMesh;

let smallRectGeometry;
let progressMaterial;
let progressMesh;

let swordGeometry;
let swordMaterial;

let gunGeometry;
let gunMaterial

let bulletGeometry;
let bulletMaterial;

let ballGeometry;
let ballMaterial;

let herbGeometry;
let herbMaterial;

let powderGeometry;
let powderMaterial;

let rockGeometry;
let rockMaterial;

let seedSamplerGeometry;
let seedSamplerMaterial;

let pollenSamplerGeometry;
let pollenSamplerMaterial;

let seedGeometry;
let seedMaterial;

let fertilizerGeometry;
let fertilizerMaterial;

let waterGeometry;
let waterMaterial;

let bloodGeometry;
let bloodMaterial;

let ichorGeometry;
let ichorMaterial;

let fireBombGeometry;
let fireBombMaterial;

let safeGeometry;
let safeMaterial;
let safeMaterialHighlight;

let lampMaterial;
let lampMaterialHighlight;

let hitEffectGeometry;
let hitEffectMaterial;

let enemy1Material;
let enemy1AttackMaterial;
let enemy1StunnedMaterial;
let enemy1AngryMaterial;

let plant1Material;

//let sceneLight;
let sceneLight2;

let createGameState = () => {
	return {
		playerList: [],
		applianceList: [],
		itemList: [],
		projectileList: [],
		effectList: [],
		enemyList: [],
		plantList: [],
		frameCount: 0,
        gameActive: true,
        roundWinner: undefined,
        roundEndCountdown: 0,
        team1Score: 0,
        team2Score: 0,
        gameFinished: false,
        gameWinner: undefined,
	}
}

let copyGameState = (gs) => {
	let gsNew = createGameState();
	gsNew.frameCount = gs.frameCount;
	copyGameObjectList(gsNew, gs.playerList, gsNew.playerList, createPlayer);
	copyGameObjectList(gsNew, gs.applianceList, gsNew.applianceList, createAppliance);
	copyGameObjectList(gsNew, gs.itemList, gsNew.itemList, createItem);
	copyGameObjectList(gsNew, gs.projectileList, gsNew.projectileList, createProjectile);
	copyGameObjectList(gsNew, gs.effectList, gsNew.effectList, createEffect);
	copyGameObjectList(gsNew, gs.enemyList, gsNew.enemyList, createEnemy);
	copyGameObjectList(gsNew, gs.plantList, gsNew.plantList, createPlant);
	// Fix references - Change references from objects in old gamestate to objects in new gamestate
	// player: heldItem
	// appliance: heldItem
	// plant: heldItem
	// item: holder
	// projectile: sourcePlayer
	// enemy: targetPlayer
	fixReferences(gsNew.playerList, "heldItem", gs.itemList, gsNew.itemList);
	fixReferences(gsNew.applianceList, "heldItem", gs.itemList, gsNew.itemList);
	fixReferences(gsNew.plantList, "heldItem", gs.itemList, gsNew.itemList);
	fixReferences(gsNew.itemList, "holder", gs.playerList, gsNew.playerList, gs.applianceList, gsNew.applianceList, gs.plantList, gsNew.plantList);
	fixReferences(gsNew.projectileList, "sourcePlayer", gs.playerList, gsNew.playerList);
	fixReferences(gsNew.enemyList, "targetPlayer", gs.playerList, gsNew.playerList);
	return gsNew;
}

let copyGameStateNoCircularRef = (gs) => {
	let gsNew = copyGameState(gs);
	gsNew.itemList.forEach(item => item.holder = undefined);
	return gsNew;
}

let copyGameObjectList = (gsNew, sourceObjectList, targetObjectList, createObjFunc) => {
	sourceObjectList.forEach(gameObject => {
		let copyObject = createObjFunc(gsNew);
		Object.keys(gameObject).forEach(key => {
			if (key !== "connectedMesh" && key !== "connectedOverlayObjects") {
				copyObject[key] = gameObject[key];
			}
		});
	});
}

let fixReferences = (fixObjectList, referenceKey, oldReferenceList, newReferenceList, oldReferenceListB, newReferenceListB, oldReferenceListC, newReferenceListC) => {
	fixObjectList.forEach(gameObject => {
		if (gameObject[referenceKey] !== undefined) {
			let oldReferenceObject = gameObject[referenceKey];
			let useListBs = false;
			let useListCs = false;
			if (gameObject.type === "item") {
				// Item can either have a player holder or appliance holder or plant holder
				// Main list: players, B list: appliances, C list: plants
				if (gameObject.heldByAppliance) {
					useListBs = true;
				}
				else if (gameObject.heldByPlant) {
					useListCs = true;
				}
			}
			if (useListBs) {
				let oldReferenceIndex = oldReferenceListB.indexOf(oldReferenceObject);
				// Assumes the lists match order
				let newReferenceObject = newReferenceListB[oldReferenceIndex];
				gameObject[referenceKey] = newReferenceObject;
			}
			else if (useListCs) {
				let oldReferenceIndex = oldReferenceListC.indexOf(oldReferenceObject);
				// Assumes the lists match order
				let newReferenceObject = newReferenceListC[oldReferenceIndex];
				gameObject[referenceKey] = newReferenceObject;
			}
			else {
				let oldReferenceIndex = oldReferenceList.indexOf(oldReferenceObject);
				// Assumes the lists match order
				let newReferenceObject = newReferenceList[oldReferenceIndex];
				gameObject[referenceKey] = newReferenceObject;
			}
		}
	});
}

let compareGameStates = (gs1, gs2) => {
	// For each comparison, either add a string describing the difference, or nothing if there is no difference
	// Overall function should return false if the game states match, or true if there is any difference
	let comparisons = [];
	if (gs1.frameCount !== gs2.frameCount) {comparisons.push(`frameCount diff ${gs1.frameCount} !== ${gs2.frameCount}`);}
	if (gs1.applianceList.length !== gs2.applianceList.length) {comparisons.push(`applicationList.length diff ${gs1.applicationList.length} !== ${gs2.applicationList.length}`);}
	gs1.applianceList.map((object, index) => {
		let matchingObject = gs2.applianceList[index];
		let hasMatch = matchingObject !== undefined;
		if (hasMatch) {
			if (object.subType !== matchingObject.subType) {comparisons.push(`appliance.subType diff ${object.subType} !== ${matchingObject.subType}`);}
			if (object.xPosition !== matchingObject.xPosition) {comparisons.push(`appliance.xPosition diff ${object.xPosition} !== ${matchingObject.xPosition}`);}
			if (object.yPosition !== matchingObject.yPosition) {comparisons.push(`appliance.yPosition diff ${object.yPosition} !== ${matchingObject.yPosition}`);}
			if (object.holdingItem !== matchingObject.holdingItem) {comparisons.push(`appliance.holdingItem diff ${object.holdingItem} !== ${matchingObject.holdingItem}`);}
			if (object.heldItem?.subType !== matchingObject.heldItem?.subType) {comparisons.push(`appliance.heldItem.subType diff ${object.heldItem?.subType} !== ${matchingObject.heldItem?.subType}`);}
		}
		else {comparisons.push(`appliance in gs1 has no match in gs2 at index ${index}`);}
	});
	if (gs1.itemList.length !== gs2.itemList.length) {comparisons.push(`itemList.length diff ${gs1.itemList.length} !== ${gs2.itemList.length}`);}
	gs1.itemList.map((object, index) => {
		let matchingObject = gs2.itemList[index];
		let hasMatch = matchingObject !== undefined;
		if (hasMatch) {
			if (object.subType !== matchingObject.subType) {comparisons.push(`item.subType diff ${object.subType} !== ${matchingObject.subType}`);}
		}
		else {comparisons.push(`item in gs1 has no match in gs2 at index ${index}`);}
	});
	if (gs1.playerList.length !== gs2.playerList.length) {comparisons.push(`playerList.length diff ${gs1.playerList.length} !== ${gs2.playerList.length}`);}
	gs1.playerList.map((object, index) => {
		let matchingObject = gs2.playerList[index];
		let hasMatch = matchingObject !== undefined;
		if (hasMatch) {
			if (object.id !== matchingObject.id) {comparisons.push(`player.id diff ${object.id} !== ${matchingObject.id}`);}
			if (object.upPressed !== matchingObject.upPressed) {comparisons.push(`player.upPressed diff ${object.upPressed} !== ${matchingObject.upPressed}`);}
			if (object.rightPressed !== matchingObject.rightPressed) {comparisons.push(`player.rightPressed diff ${object.rightPressed} !== ${matchingObject.rightPressed}`);}
			if (object.downPressed !== matchingObject.downPressed) {comparisons.push(`player.downPressed diff ${object.downPressed} !== ${matchingObject.downPressed}`);}
			if (object.leftPressed !== matchingObject.leftPressed) {comparisons.push(`player.leftPressed diff ${object.leftPressed} !== ${matchingObject.leftPressed}`);}
			if (object.rotation !== matchingObject.rotation) {comparisons.push(`player.rotation diff ${object.rotation} !== ${matchingObject.rotation}`);}
			if (object.xMousePosition !== matchingObject.xMousePosition) {comparisons.push(`player.xMousePosition diff ${object.xMousePosition} !== ${matchingObject.xMousePosition}`);}
			if (object.yMousePosition !== matchingObject.yMousePosition) {comparisons.push(`player.yMousePosition diff ${object.yMousePosition} !== ${matchingObject.yMousePosition}`);}
			if (object.interactPressed !== matchingObject.interactPressed) {comparisons.push(`player.interactPressed diff ${object.interactPressed} !== ${matchingObject.interactPressed}`);}
			if (object.reloadPressed !== matchingObject.reloadPressed) {comparisons.push(`player.reloadPressed diff ${object.reloadPressed} !== ${matchingObject.reloadPressed}`);}
			if (object.flashlightPressed !== matchingObject.flashlightPressed) {comparisons.push(`player.flashlightPressed diff ${object.flashlightPressed} !== ${matchingObject.flashlightPressed}`);}
			if (object.runPressed !== matchingObject.runPressed) {comparisons.push(`player.runPressed diff ${object.runPressed} !== ${matchingObject.runPressed}`);}
			if (object.firePressed !== matchingObject.firePressed) {comparisons.push(`player.firePressed diff ${object.firePressed} !== ${matchingObject.firePressed}`);}
			if (object.readyPressed !== matchingObject.readyPressed) {comparisons.push(`player.readyPressed diff ${object.readyPressed} !== ${matchingObject.readyPressed}`);}
			if (object.xPosition !== matchingObject.xPosition) {comparisons.push(`player.xPosition diff ${object.xPosition} !== ${matchingObject.xPosition}`);}
			if (object.xSpeed !== matchingObject.xSpeed) {comparisons.push(`player.xSpeed diff ${object.xSpeed} !== ${matchingObject.xSpeed}`);}
			if (object.yPosition !== matchingObject.yPosition) {comparisons.push(`player.yPosition diff ${object.yPosition} !== ${matchingObject.yPosition}`);}
			if (object.ySpeed !== matchingObject.ySpeed) {comparisons.push(`player.ySpeed diff ${object.ySpeed} !== ${matchingObject.ySpeed}`);}
			if (object.health !== matchingObject.health) {comparisons.push(`player.health diff ${object.health} !== ${matchingObject.health}`);}
			if (object.holdingItem !== matchingObject.holdingItem) {comparisons.push(`player.holdingItem diff ${object.holdingItem} !== ${matchingObject.holdingItem}`);}
			if (object.heldItem?.subType !== matchingObject.heldItem?.subType) {comparisons.push(`player.heldItem diff ${object.heldItem?.subType} !== ${matchingObject.heldItem?.subType}`);}
		}
		else {comparisons.push(`player in gs1 has no match in gs2 at index ${index}`);}
	});
	if (gs1.projectileList.length !== gs2.projectileList.length) {comparisons.push(`projectileList.length diff ${gs1.projectileList.length} !== ${gs2.projectileList.length}`);}
	gs1.projectileList.map((object, index) => {
		let matchingObject = gs2.projectileList[index];
		let hasMatch = matchingObject !== undefined;
		if (hasMatch) {
			if (object.subType !== matchingObject.subType) {comparisons.push(`projectile.subType diff ${object.subType} !== ${matchingObject.subType}`);}
			if (object.xPosition !== matchingObject.xPosition) {comparisons.push(`projectile.xPosition diff ${object.xPosition} !== ${matchingObject.xPosition}`);}
			if (object.yPosition !== matchingObject.yPosition) {comparisons.push(`projectile.yPosition diff ${object.yPosition} !== ${matchingObject.yPosition}`);}
			if (object.sourcePlayer?.id !== matchingObject.sourcePlayer?.id) {comparisons.push(`projectile.sourcePlayer.id diff ${object.sourcePlayer.id} !== ${matchingObject.sourcePlayer.id}`);}
			if (object.rotation !== matchingObject.rotation) {comparisons.push(`projectile.rotation diff ${object.rotation} !== ${matchingObject.rotation}`);}
			if (object.lifespan !== matchingObject.lifespan) {comparisons.push(`projectile.lifespan diff ${object.lifespan} !== ${matchingObject.lifespan}`);}
		}
		else {comparisons.push(`projectile in gs1 has no match in gs2 at index ${index}`);}
	});
	// Ignoring effect list
	//gameState1.effectList.map((object, index) => {
		//return true;
	//}),
	if (gs1.enemyList.length !== gs2.enemyList.length) {comparisons.push(`enemyList.length diff ${gs1.enemyList.length} !== ${gs2.enemyList.length}`);}
	gs1.enemyList.map((object, index) => {
		let matchingObject = gs2.enemyList[index];
		let hasMatch = matchingObject !== undefined;
		if (hasMatch) {
			if (object.subType !== matchingObject.subType) {comparisons.push(`enemy.subType diff ${object.subType} !== ${matchingObject.subType}`);}
			if (object.xPosition !== matchingObject.xPosition) {comparisons.push(`enemy.xPosition diff ${object.xPosition} !== ${matchingObject.xPosition}`);}
			if (object.yPosition !== matchingObject.yPosition) {comparisons.push(`enemy.yPosition diff ${object.yPosition} !== ${matchingObject.yPosition}`);}
			if (object.rotation !== matchingObject.rotation) {comparisons.push(`enemy.rotation diff ${object.rotation} !== ${matchingObject.rotation}`);}
		}
		else {comparisons.push(`enemy in gs1 has no match in gs2 at index ${index}`);}
	});
	if (gs1.plantList.length !== gs2.plantList.length) {comparisons.push(`plantList.length diff ${gs1.plantList.length} !== ${gs2.plantList.length}`);}
	gs1.plantList.map((object, index) => {
		let matchingObject = gs2.plantList[index];
		let hasMatch = matchingObject !== undefined;
		if (hasMatch) {
			if (object.subType !== matchingObject.subType) {comparisons.push(`plant.subType diff ${object.subType} !== ${matchingObject.subType}`);}
			if (object.xPosition !== matchingObject.xPosition) {comparisons.push(`plant.xPosition diff ${object.xPosition} !== ${matchingObject.xPosition}`);}
			if (object.yPosition !== matchingObject.yPosition) {comparisons.push(`plant.yPosition diff ${object.yPosition} !== ${matchingObject.yPosition}`);}
			if (object.rotation !== matchingObject.rotation) {comparisons.push(`plant.rotation diff ${object.rotation} !== ${matchingObject.rotation}`);}
		}
		else {comparisons.push(`plant in gs1 has no match in gs2 at index ${index}`);}
	});
	comparisons = comparisons.flat(1);
	// Any truthy value means there was a difference. (the truthy value would be a string)
	let overallResult = comparisons.reduce((result, comparison) => {
		if (comparison !== false) {
			return true;
		}
		return result;
	}, false);
	if (overallResult === true) {
		console.log("Difference detected");
		console.log(comparisons);
		debugger;
	}
	return overallResult;
}

let currentGameState;
let gameStateHistory = [];
let gameStarted = false;
let gamePaused = false;
let currentFrameCount = 0;
let playerInputLog = [];
let rollbackInputReceived = false;
let latestFullInputFrame = 0;
let localPlayerID;
let lastInputSentFrame = 0;
let playerFrameAdvantages = [];
let initialGameStateCopy;

let playerMeshList = [];
let applianceMeshList = [];
let itemMeshList = [];
let projectileMeshList = [];
let effectMeshList = [];
let enemyMeshList = [];
let plantMeshList = [];

let createPlayer = (gs, name, id, team) => {
	let newPlayer = {
		type: "player",
		// Position and movement
		xPosition: 0,
		yPosition: 0,
		xStartPosition: 0,
		yStartPosition: 0,
		xSpeed: 0,
		ySpeed: 0,
		rotation: 0,
		// Appliance targeting
		xTarget: 0,
		yTarget: 0,
		// Status
		health: 10,
		maxHealth: 10,
		// Item
		itemCooldown: 0,
		holdingItem: false,
		heldItem: undefined,
		// Controls
		upPressed: false,
		rightPressed: false,
		downPressed: false,
		leftPressed: false,
		interactPressed: false,
		reloadPressed: false,
		flashlightPressed: false,
		runPressed: false,
		firePressed: false,
		readyPressed: false,
		// Mouse controls
		xMousePosition: 0,
		yMousePosition: 0,
        xMousePrevPosition: 0,
        yMousePrevPosition: 0,
        movedMouseWhileStill: false,
		// Released actions
		interactReleased: false,
		reloadReleased: false,
		flashlightReleased: false,
		runReleased: false,
		fireReleased: false,
		readyReleased: false,
		// Flashlight
		flashlightOn: true,
		// Graphics
		connectedMesh: undefined,
		connectedOverlayObjects: {},
		// Game coordination
		id: id,
		name: name,
		team: team,
		defeated: false,
		toBeRemoved: false,
	};
	gs.playerList.push(newPlayer);
	return newPlayer;
}
let resetPlayerObject = (playerObject) => {
	playerObject.xPosition = playerObject.xStartPosition;
	playerObject.yPosition = playerObject.yStartPosition;
	playerObject.xSpeed = 0;
	playerObject.ySpeed = 0;
	playerObject.rotation = 0;
	// Appliance targeting
	playerObject.xTarget = 0;
	playerObject.yTarget = 0;
	// Status
	playerObject.health = 10;
	playerObject.maxHealth = 10;
	// Item
	playerObject.itemCooldown = 0;
	playerObject.holdingItem = false;
	playerObject.heldItem = undefined;
	// Controls
	playerObject.upPressed = false;
	playerObject.rightPressed = false;
	playerObject.downPressed = false;
	playerObject.leftPressed = false;
	playerObject.interactPressed = false;
	playerObject.reloadPressed = false;
	playerObject.flashlightPressed = false;
	playerObject.runPressed = false;
	playerObject.firePressed = false;
	playerObject.readyPressed = false;
	// Mouse controls
	playerObject.xMousePosition = 0;
	playerObject.yMousePosition = 0;
	playerObject.xMousePrevPosition = 0;
	playerObject.yMousePrevPosition = 0;
	playerObject.movedMouseWhileStill = false;
	// Released actions
	playerObject.interactReleased = false;
	playerObject.reloadReleased = false;
	playerObject.flashlightReleased = false;
	playerObject.runReleased = false;
	playerObject.fireReleased = false;
	playerObject.readyReleased = false;
	// Flashlight
	playerObject.flashlightOn = true;
	// Defeated
	playerObject.defeated = false;
}
let createPlayerMesh = (playerObject) => {
	let matToUse = playerMaterial;
	if (playerObject.team === 1) {
		matToUse = playerTeam1Material;
	}
	else if (playerObject.team === 2) {
		matToUse = playerTeam2Material;
	}
	let playerMesh = new THREE.Mesh(cubeGeometry, matToUse);
	playerMesh.scale.x = 0.8;
	playerMesh.scale.y = 0.8;
	playerMesh.scale.z = 1.5;
	playerMesh.castShadow = true;
	playerMesh.receiveShadow = true;
	scene.add(playerMesh);
	// Point light
	let playerPointLight = new THREE.PointLight(0xffffff, 0.1, 5);
	playerPointLight.castShadow = true;
	scene.add(playerPointLight);
	playerPointLight.parent = playerMesh;
	playerPointLight.position.set(1.4, 0, 1.3);
	playerMesh.pointLight = playerPointLight;
	// Spot light
	let playerSpotLight = new THREE.SpotLight(0xffffff, 1, 10, 0.5, 0.5, 2);
	playerSpotLight.castShadow = true;
	scene.add(playerSpotLight);
	playerSpotLight.parent = playerMesh;
	playerSpotLight.position.set(0.5, 0, 0.3);
	playerMesh.spotLight = playerSpotLight;
	// Spot light's target
	scene.add(playerSpotLight.target);
	playerSpotLight.target.parent = playerMesh;
	playerSpotLight.target.position.set(0.9, 0, 0.25);
	// Add player's mesh to mesh list
	playerMeshList.push(playerMesh);
	return playerMesh;
}
let removePlayer = (gs, playerObject) => {
	gs.playerList.splice(gs.playerList.indexOf(playerObject), 1);
}

let createAppliance = (gs, applianceType, xPosition, yPosition) => {
	let newAppliance = {
		type: "appliance",
		subType: applianceType,
		xPosition: xPosition || 0,
		yPosition: yPosition || 0,
		rotation: 0,
		holdingItem: false,
		heldItem: undefined,
		connectedMesh: undefined,
		regularMat: undefined,
		highlightMat: undefined,
		assignedTeam: undefined,
		connectedOverlayObjects: {},
		toBeRemoved: false,
	};
    if (applianceType === "lamp") {
        newAppliance.lightOn = true;
    }
	gs.applianceList.push(newAppliance);
	return newAppliance;
}
let createApplianceMesh = (applianceObject) => {
	let applianceMesh;
	if (applianceObject.subType === "wall") {
		applianceMesh = new THREE.Mesh(cubeGeometry, wallMaterial);
		applianceObject.regularMat = wallMaterial;
		applianceObject.highlightMat = wallMaterial;
		applianceMesh.scale.z = 2;
	}
	else if (applianceObject.subType === "table") {
		applianceMesh = new THREE.Mesh(cubeGeometry, tableMaterial);
		applianceObject.regularMat = tableMaterial;
		applianceObject.highlightMat = tableMaterialHighlight;
	}
	else if (applianceObject.subType === "supply") {
		applianceMesh = new THREE.Mesh(cubeGeometry, supplyMaterial);
		applianceObject.regularMat = supplyMaterial;
		applianceObject.highlightMat = supplyMaterialHighlight;
	}
	else if (applianceObject.subType === "lamp") {
		applianceMesh = new THREE.Mesh(sphereGeometry, lampMaterial);
		applianceObject.regularMat = lampMaterial;
		applianceObject.highlightMat = lampMaterialHighlight;
		// TODO: Create light for the lamp
		let appliancePointLight = new THREE.PointLight(0xffffff, 0.4, 8);
		appliancePointLight.castShadow = true;
		scene.add(appliancePointLight);
		appliancePointLight.parent = applianceMesh;
		appliancePointLight.position.set(0, 0, 0);
		applianceMesh.pointLight = appliancePointLight;
	}
	else if (applianceObject.subType === "safe") {
		applianceMesh = new THREE.Mesh(safeGeometry, safeMaterial);
		//applianceMesh.scale.multiplyScalar(0.5);
		applianceObject.regularMat = safeMaterial;
		applianceObject.highlightMat = safeMaterialHighlight;
	}
	else {
		console.log("appliance type missing: " + applianceObject.subType);
		applianceMesh = new THREE.Mesh(cubeGeometry, tableMaterial);
	}
	// Lamps don't cast or receive shadows
	if (applianceObject.subType === "lamp") {
		applianceMesh.castShadow = false;
		applianceMesh.receiveShadow = false;
	}
	else {
		applianceMesh.castShadow = true;
		applianceMesh.receiveShadow = true;
	}
	scene.add(applianceMesh);
	applianceMeshList.push(applianceMesh);
	return applianceMesh;
}
let removeAppliance = (gs, applianceObject) => {
	gs.applianceList.splice(gs.applianceList.indexOf(applianceObject), 1);
}

let createItem = (gs, itemType) => {
	let newItem = {
		type: "item",
		processed: false,
		progress: 0,
		subType: itemType,
		holder: undefined,
		heldByPlayer: false,
		heldByAppliance: false,
		heldByPlant: false,
		extraInfo: {},
		connectedMesh: undefined,
		connectedOverlayObjects: {},
		fixedRotation: true,
		initialRotation: 0,
		hasAbility: false,
		toBeRemoved: false,
	};
	if (itemType === "sword" || itemType === "gun" || itemType === "ball" || itemType === "fireBomb") {
		newItem.fixedRotation = false;
		newItem.initialRotation = - Math.PI / 2;
		newItem.hasAbility = true;
	}
	if (itemType === "seed" || itemType === "pollenSampler") {
		newItem.extraInfo.genome = getBlankGenome();
	}
	gs.itemList.push(newItem);
	return newItem;
}
let createItemMesh = (itemObject) => {
	let newItemMesh;
	if (itemObject.subType === "sword") {
		newItemMesh = new THREE.Mesh(swordGeometry, swordMaterial);
	}
	else if (itemObject.subType === "gun") {
		newItemMesh = new THREE.Mesh(gunGeometry, gunMaterial);
	}
	else if (itemObject.subType === "bullet") {
		newItemMesh = new THREE.Mesh(bulletGeometry, bulletMaterial);
	}
	else if (itemObject.subType === "ball") {
		newItemMesh = new THREE.Mesh(ballGeometry, ballMaterial);
	}
	else if (itemObject.subType === "herb") {
		newItemMesh = new THREE.Mesh(herbGeometry, herbMaterial);
	}
	else if (itemObject.subType === "rock") {
		newItemMesh = new THREE.Mesh(rockGeometry, rockMaterial);
		newItemMesh.scale.multiplyScalar(0.3);
	}
	else if (itemObject.subType === "powder") {
		newItemMesh = new THREE.Mesh(powderGeometry, powderMaterial);
	}
	else if (itemObject.subType === "seedSampler") {
		newItemMesh = new THREE.Mesh(seedSamplerGeometry, seedSamplerMaterial);
	}
	else if (itemObject.subType === "pollenSampler") {
		newItemMesh = new THREE.Mesh(pollenSamplerGeometry, pollenSamplerMaterial);
	}
	else if (itemObject.subType === "seed") {
		newItemMesh = new THREE.Mesh(seedGeometry, seedMaterial);
	}
	else if (itemObject.subType === "fertilizer") {
		newItemMesh = new THREE.Mesh(fertilizerGeometry, fertilizerMaterial);
	}
	else if (itemObject.subType === "water") {
		newItemMesh = new THREE.Mesh(waterGeometry, waterMaterial);
	}
	else if (itemObject.subType === "blood") {
		newItemMesh = new THREE.Mesh(bloodGeometry, bloodMaterial);
	}
	else if (itemObject.subType === "ichor") {
		newItemMesh = new THREE.Mesh(ichorGeometry, ichorMaterial);
	}
	else if (itemObject.subType === "fireBomb") {
		newItemMesh = new THREE.Mesh(fireBombGeometry, fireBombMaterial);
	}
	else {
		console.log("item type missing: " + itemObject.subType);
		newItemMesh = new THREE.Mesh(sphereGeometry, itemMaterial);
	}
	scene.add(newItemMesh);
	itemMeshList.push(newItemMesh);
	return newItemMesh;
}
let removeItem = (gs, itemObject) => {
	gs.itemList.splice(gs.itemList.indexOf(itemObject), 1);
}

let createProjectile = (gs, projectileType, xPosition, yPosition, rotation, speed) => {
	let newProjectile = {
		type: "projectile",
		subType: projectileType,
		connectedMesh: undefined,
		connectedOverlayObjects: {},
		xPosition: xPosition || 0,
		yPosition: yPosition || 0,
		rotation: rotation || 0,
		speed: speed || 0,
		sourcePlayer: undefined,
		sourceIsEnemy: false,
		lifespan: 500,
		toBeRemoved: false,
	};
	gs.projectileList.push(newProjectile);
	return newProjectile;
}
let createProjectileMesh = (projectileObject) => {
	let newProjectileMesh;
	if (projectileObject.subType === "bullet") {
		newProjectileMesh = new THREE.Mesh(bulletGeometry, bulletMaterial);
	}
	else if (projectileObject.subType === "thrownBall") {
		newProjectileMesh = new THREE.Mesh(ballGeometry, ballMaterial);
	}
	else if (projectileObject.subType === "swordSwing") {
		newProjectileMesh = new THREE.Mesh(swordGeometry, swordMaterial);
	}
	else if (projectileObject.subType === "fireBombToss") {
		newProjectileMesh = new THREE.Mesh(fireBombGeometry, fireBombMaterial);
	}
	else {
		console.log("projectile type missing: " + projectileObject.subType);
		newProjectileMesh = new THREE.Mesh(bulletGeometry, bulletMaterial);
	}
	scene.add(newProjectileMesh);
	projectileMeshList.push(newProjectileMesh);
	return newProjectileMesh;
}
let removeProjectile = (gs, projectileObject) => {
	gs.projectileList.splice(gs.projectileList.indexOf(projectileObject), 1);
}

let createEffect = (gs, effectType, xPosition, yPosition) => {
	let newEffect = {
		type: "effect",
		subType: effectType,
		connectedMesh: undefined,
		connectedOverlayObjects: {},
		xPosition: xPosition || 0,
		yPosition: yPosition || 0,
		lifespan: 50,
		toBeRemoved: false,
	};
	gs.effectList.push(newEffect);
	return newEffect;
}
let createEffectMesh = (effectObject) => {
	let newEffectMesh;
	if (effectObject.subType === "hit") {
		newEffectMesh = new THREE.Mesh(hitEffectGeometry, hitEffectMaterial);
	}
	scene.add(newEffectMesh);
	effectMeshList.push(newEffectMesh);
	return newEffectMesh;
}
let removeEffect = (gs, effectObject) => {
	gs.effectList.splice(gs.effectList.indexOf(effectObject), 1);
}

let createEnemy = (gs, enemyType, xPosition, yPosition) => {
	let newEnemy = {
		type: "enemy",
		subType: enemyType,
		connectedMesh: undefined,
		connectedOverlayObjects: {},
		xPosition: xPosition || 0,
		yPosition: yPosition || 0,
		xSpeed: 0,
		ySpeed: 0,
		rotation: 0,
		xTarget: 0,
		yTarget: 0,
		health: 20,
		maxHealth: 20,
		state: "idle",
		stateTimer: 0,
		targetPlayer: undefined,
		stagger: 0,
		maxStagger: 10,
		defeated: false,
		toBeRemoved: false,
	};
	gs.enemyList.push(newEnemy);
	return newEnemy;
}
let createEnemyMesh = (enemyObject) => {
	let newEnemyMesh;
	if (enemyObject.subType === "enemy1") {
		newEnemyMesh = new THREE.Mesh(cubeGeometry, enemy1Material);
	}
	else {
		newEnemyMesh = new THREE.Mesh(cubeGeometry, enemy1Material);
	}
	scene.add(newEnemyMesh);
	enemyMeshList.push(newEnemyMesh);
	return newEnemyMesh;
}
let removeEnemy = (gs, enemyObject) => {
	gs.enemyList.splice(gs.enemyList.indexOf(enemyObject), 1);
}

let getBlankGenome = () => {
	return {
		geneticPower: 10,
		makesSword: false,
		makesFireBomb: false,
	}
}

let createPlant = (gs, plantType, xPosition, yPosition) => {
	let newPlant = {
		type: "plant",
		subType: plantType,
		regularMat: undefined,
		highlightMat: undefined,
		connectedMesh: undefined,
		connectedOverlayObjects: {},
		xPosition: xPosition || 0,
		yPosition: yPosition || 0,
		rotation: 0,
		growth: 0,
		maxGrowth: 10,
		power: 0,
		maxPower: 10,
		doneGrowing: false,
		producedItem: false,
		genome: getBlankGenome(),
		holdingItem: false,
		heldItem: undefined,
		toBeRemoved: false,
	};
	gs.plantList.push(newPlant);
	return newPlant;
}
let createPlantMesh = (plantObject) => {
	let newPlantMesh;
	if (plantObject.subType === "plant1") {
		newPlantMesh = new THREE.Mesh(cubeGeometry, plant1Material);
	}
	else {
		newPlantMesh = new THREE.Mesh(cubeGeometry, plant1Material);
	}
	scene.add(newPlantMesh);
	plantMeshList.push(newPlantMesh);
	return newPlantMesh;
}
let removePlant = (gs, plantObject) => {
	gs.plantList.splice(gs.plantList.indexOf(plantObject), 1);
}

// Keys
let wDown = false;
let aDown = false;
let sDown = false;
let dDown = false;
let eDown = false;
let rDown = false;
let fDown = false;
let shiftDown = false;

// Mouse
let xMouseScreen = 0;
let yMouseScreen = 0;
let leftMouseDown = false;
let rightMouseDown = false;

let backgroundOverGame;
let roomListElement;
let teamBox1;
let teamBox2;
let nickname = "";
let nicknameInput;
let makeRoomButton;
let leaveRoomButton;
let joinTeam1Button;
let joinTeam2Button;
let startGameButton;
let pauseGameButton;
let hitBreakpointButton;
let desyncToolButton;
let team1WinButton;
let team2WinButton;

let gameStartPlayerInfo;
let otherPlayers = [];

let gameOverlay;
let overlayList = [];

let gameUI;

let glTFLoader;

let modelLoadList = [
	{model: "rock2", name: "rock", setGeo: geo => rockGeometry = geo, setMat: mat => rockMaterial = mat},
	{model: "safe1", name: "safe", setGeo: geo => {
		safeGeometry = geo;
		safeGeometry.scale(0.6, 0.6, 0.6);
		safeGeometry.rotateX(Math.PI / 2);
		safeGeometry.rotateZ(-Math.PI / 2);
	}},
];

let init = () => {

	glTFLoader = new GLTFLoader();

	modelLoadList.forEach(loadItem => {
		glTFLoader.load(`models/${loadItem.model}.gltf`,
			(gltf) => {
				if (loadItem.setGeo !== undefined) {
					loadItem.setGeo(gltf.scene.children[0].geometry);
				}
				if (loadItem.setMat !== undefined) {
					loadItem.setMat(gltf.scene.children[0].material);
				}
				console.log(`${loadItem.name} model loaded`);
			},
			(xhr) => {
			},
			(err) => {
			}
		);
	});

	currentFrameSpan = document.getElementById("current_frame");
	rollbacksSpan = document.getElementById("rollbacks");
	resimulatedFramesSpan = document.getElementById("resimulated_frames");
	largestRemoteLagSpan = document.getElementById("largest_remote_lag");

    gameStatusMessageSpan = document.getElementById("game_status_message");
    team1ScoreSpan = document.getElementById("team_1_score");
    team2ScoreSpan = document.getElementById("team_2_score");

	backgroundOverGame = document.getElementsByClassName("background_over_game").item(0);
	roomListElement = document.getElementById("room_list");
	teamBox1 = document.getElementById("team_1");
	teamBox2 = document.getElementById("team_2");

	gameOverlay = document.getElementById("game_overlay");
	gameUI = document.getElementById("game_ui");

	setupNetworkConnection();

	nicknameInput = document.getElementById("nickname");
	let savedNickname = localStorage.getItem("shadow_game__nickname");
	if (!!savedNickname) {
		nickname = savedNickname;
		nicknameInput.value = nickname;
	}
	nicknameInput.oninput = (e) => {
		nickname = nicknameInput.value;
		localStorage.setItem("shadow_game__nickname", nickname);
	}

	makeRoomButton = document.getElementById("make_room");
	makeRoomButton.onclick = (e) => {
		goToView("waiting");
		sendData("makeRoom", {roomName: `${nickname}'s room`, playerName: nickname});
	}

	leaveRoomButton = document.getElementById("leave_room");
	leaveRoomButton.onclick = (e) => {
		goToView("entry");
		sendData("leaveRoom", 0);
		document.querySelectorAll(".player_entry").forEach(playerEntry => playerEntry.remove());
	}

	joinTeam1Button = document.getElementById("join_team_1");
	joinTeam1Button.onclick = (e) => {
		sendData("switchTeam", 1);
	}

	joinTeam2Button = document.getElementById("join_team_2");
	joinTeam2Button.onclick = (e) => {
		sendData("switchTeam", 2);
	}

	startGameButton = document.getElementById("start_game");
	startGameButton.onclick = (e) => {
		sendData("startGame", 0);
	}

	pauseGameButton = document.getElementById("pause_game");
	pauseGameButton.onclick = (e) => {
		gamePaused = !gamePaused;
		if (gamePaused) {
			sendData("pauseGame", currentFrameCount);
			pauseGameButton.textContent = "Resume Game";
		}
		else {
			sendData("resumeGame", currentFrameCount);
			pauseGameButton.textContent = "Pause Game";
		}
	}

	hitBreakpointButton = document.getElementById("hit_breakpoint");
	hitBreakpointButton.onclick = (e) => {
		debugger;
	}

	desyncToolButton = document.getElementById("run_desync_tool");
	desyncToolButton.onclick = (e) => {
		sendData("desyncTool", 0);
	}

	team1WinButton = document.getElementById("test_team_1_win");
	team1WinButton.onclick = (e) => {
		sendData("test_team_win", {team:1, frameCount: currentGameState.frameCount + 30});
	}

	team2WinButton = document.getElementById("test_team_2_win");
	team2WinButton.onclick = (e) => {
		sendData("test_team_win", {team:2, frameCount: currentGameState.frameCount + 30});
	}

	//nicknameInput.oninput
	scene = new THREE.Scene();
	camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
	camera.position.z = 10;
	renderer = new THREE.WebGLRenderer();
	renderer.setSize(window.innerWidth, window.innerHeight);
	document.body.appendChild(renderer.domElement);
	renderer.shadowMap.enabled = true;
	//renderer.shadowMap.type = THREE.PCFSoftShadowMap;

	// Geometries
	cubeGeometry = new THREE.BoxGeometry(1, 1, 1);
	planeGeometry = new THREE.PlaneGeometry(10, 10);
	sphereGeometry = new THREE.SphereGeometry(0.25, 6, 6);
	smallRectGeometry = new THREE.PlaneGeometry(0.9, 0.3);
	// More specific geometries
	swordGeometry = new THREE.ConeGeometry(0.15, 1, 3, 1);
	gunGeometry = new THREE.BoxGeometry(0.2, 0.45, 0.2);
	bulletGeometry = new THREE.SphereGeometry(0.17, 5, 4);
	ballGeometry = new THREE.DodecahedronGeometry(0.35, 0);
	herbGeometry = new THREE.LatheGeometry(undefined, 8, 0, 2 * Math.PI);
	powderGeometry = new THREE.CapsuleGeometry(0.1, 0.2, 2, 7);
	hitEffectGeometry = new THREE.RingGeometry(0.2, 0.5, 14);

	powderGeometry = new THREE.CapsuleGeometry(0.1, 0.2, 2, 7);
	seedSamplerGeometry = new THREE.CapsuleGeometry(0.1, 0.2, 2, 7);
	pollenSamplerGeometry = new THREE.CapsuleGeometry(0.1, 0.2, 2, 7);
	seedGeometry = new THREE.CapsuleGeometry(0.1, 0.2, 2, 7);
	fertilizerGeometry = new THREE.CapsuleGeometry(0.1, 0.2, 2, 7);
	waterGeometry = new THREE.CapsuleGeometry(0.1, 0.2, 2, 7);
	bloodGeometry = new THREE.CapsuleGeometry(0.1, 0.2, 2, 7);
	ichorGeometry = new THREE.CapsuleGeometry(0.1, 0.2, 2, 7);
	fireBombGeometry = new THREE.CapsuleGeometry(0.1, 0.2, 2, 7);

	// Materials
	playerMaterial = new THREE.MeshToonMaterial({color: 0x22ff22});
	playerTeam1Material = new THREE.MeshToonMaterial({color: 0xff7777});
	playerTeam1DefeatedMaterial = new THREE.MeshToonMaterial({color: 0xff7777});
	playerTeam1DefeatedMaterial.transparent = true;
	playerTeam1DefeatedMaterial.opacity = 0.3;
	playerTeam2Material = new THREE.MeshToonMaterial({color: 0x77ff77});
	playerTeam2DefeatedMaterial = new THREE.MeshToonMaterial({color: 0x77ff77});
	playerTeam2DefeatedMaterial.transparent = true;
	playerTeam2DefeatedMaterial.opacity = 0.3;
	floorMaterial = new THREE.MeshToonMaterial({color: 0x504030});
	wallMaterial = new THREE.MeshToonMaterial({color: 0x909090});
	//wallMaterial.shadowSide = THREE.DoubleSide;
	wallMaterialHighlight = new THREE.MeshToonMaterial({color: 0x909090});
	tableMaterial = new THREE.MeshToonMaterial({color: 0xccaa22});
	tableMaterialHighlight = new THREE.MeshToonMaterial({color: 0xddbb33});
	supplyMaterial = new THREE.MeshToonMaterial({color: 0xaa99cc});
	supplyMaterialHighlight = new THREE.MeshToonMaterial({color: 0xbbaadd});
	itemMaterial = new THREE.MeshToonMaterial({color: 0x2266dd});
	itemMaterial2 = new THREE.MeshToonMaterial({color: 0xdd2266});
	progressMaterial = new THREE.MeshToonMaterial({color: 0x33ffbb});
	// More materials
	swordMaterial = new THREE.MeshToonMaterial({color: 0x90909a});
	gunMaterial = new THREE.MeshToonMaterial({color: 0x6f7064});
	bulletMaterial = new THREE.MeshToonMaterial({color: 0xc6a039});
	ballMaterial = new THREE.MeshToonMaterial({color: 0xdf202f});
	herbMaterial = new THREE.MeshToonMaterial({color: 0x10c040});
	powderMaterial = new THREE.MeshToonMaterial({color: 0x60a080});
	//rockMaterial = new THREE.MeshToonMaterial({color: 0x994433});
	lampMaterial = new THREE.MeshToonMaterial({color: 0xeeeeaa});
	lampMaterialHighlight = new THREE.MeshToonMaterial({color: 0xeeeecc});
	safeMaterial = new THREE.MeshToonMaterial({color: 0x444444});
	safeMaterialHighlight = new THREE.MeshToonMaterial({color: 0x555555});
	enemy1Material = new THREE.MeshToonMaterial({color: 0x707070});
	enemy1AttackMaterial = new THREE.MeshToonMaterial({color: 0x909070});
	enemy1StunnedMaterial = new THREE.MeshToonMaterial({color: 0x8090a0});
	enemy1AngryMaterial = new THREE.MeshToonMaterial({color: 0xa09080});
	plant1Material = new THREE.MeshToonMaterial({color: 0x309010});
	// More materials 2
	seedSamplerMaterial = new THREE.MeshToonMaterial({color: 0x50a070});
	pollenSamplerMaterial = new THREE.MeshToonMaterial({color: 0xd0a010});
	seedMaterial = new THREE.MeshToonMaterial({color: 0xa08020});
	fertilizerMaterial = new THREE.MeshToonMaterial({color: 0x305020});
	waterMaterial = new THREE.MeshToonMaterial({color: 0x6080f8});
	bloodMaterial = new THREE.MeshToonMaterial({color: 0xe03040});
	ichorMaterial = new THREE.MeshToonMaterial({color: 0xf0f090});
	fireBombMaterial = new THREE.MeshToonMaterial({color: 0xf84010});

	// Single use meshes
	floorMesh = new THREE.Mesh(planeGeometry, floorMaterial);
	floorMesh.position.set(1, 0, -0.5);
	floorMesh.scale.set(8, 8, 1);
	floorMesh.receiveShadow = true;
	scene.add(floorMesh);

	// Lights
	//sceneLight = new THREE.PointLight(0xffffff, 0.2, 14);
	//sceneLight.position.set(4, 4, 4);
	//scene.add(sceneLight);
	sceneLight2 = new THREE.AmbientLight(0xffffff, 0.005);
	scene.add(sceneLight2);

	addEventListener("keydown", keyDownFunction);
	addEventListener("keyup", keyUpFunction);
	addEventListener("mousedown", mouseDownFunction);
	addEventListener("mouseup", mouseUpFunction);
	addEventListener("mousemove", mouseMoveFunction);
	addEventListener("contextmenu", contextMenuFunction);
	addEventListener("resize", resizeFunction);
}
window.addEventListener('load', init);

let levelLayout = [
	".#######................",
	"#1.G....#....##.........",
	"#........#..#..#........",
	"#*...TT######..#........",
	"#...............#.......",
	"#..........TTT#####.....",
	"#T........T........####.",
	"#......................#",
	"#.........####.........#",
	"#..T.T.................#",
	"#..........#TT###T.....#",
	"#...................T..#",
	"#......####...#........#",
	".##.####...........T...#",
	"...#....###............#",
	"...........####T#T....*#",
	"............#..........#",
	".............#.....G..2#",
	"..............#########.",
];

let initializeGameState = (gs) => {
	// make based on levelLayout
	let startLocations = {t1x: 0, t1y: 0, t2x: 0, t2y: 0};
	levelLayout.forEach((line, x) => {
		let split = line.split("");
		split.forEach((letter, y) => {
			if (letter === ".") {
				// Nothing
			}
			else if (letter === "#") {
				// Wall
				createAppliance(gs, "wall", x, y);
			}
			else if (letter === "T") {
				// Table
				createAppliance(gs, "table", x, y);
			}
			else if (letter === "G") {
				// supply table with gun
				let newSupply = createAppliance(gs, "supply", x, y);
				let newItem = createItem(gs, "gun");
				transferItem(gs, undefined, newSupply, newItem);
			}
			else if (letter === "1") {
				// Team 1 start location
				startLocations.t1x = x;
				startLocations.t1y = y;
			}
			else if (letter === "2") {
				// Team 1 start location
				startLocations.t2x = x;
				startLocations.t2y = y;
			}
			else if (letter === "*") {
				// Lamp
				let newTable = createAppliance(gs, "lamp", x, y);
			}
		});
	});
	return startLocations;
}

let currentView = "entry";
let goToView = (view) => {
	let prevViewElement = document.getElementsByClassName("active_view").item(0);
	let nextViewElement = document.querySelector(`[view="${view}"]`)
	prevViewElement.classList.remove("active_view");
	nextViewElement.classList.add("active_view");
	currentView = view;
}

let roomJoinButtonFunction = (e) => {
	let roomID = e.target.getAttribute("roomID");
	goToView("waiting");
	sendData("joinRoom", {roomID: roomID, playerName: nickname});
}

let makeRoomOption = (roomName, roomID, gameStarted) => {
	let existingOption = document.querySelector(`button.room_option_button[roomid="${roomID}"]`);
	// Replace existing button if one already exists
	if (existingOption) {
		if (gameStarted) {
			existingOption.disabled = true;
		}
		return;
	}

	let newOption = document.createElement("button");
	newOption.classList.add("room_option_button");
	newOption.onclick = roomJoinButtonFunction;
	newOption.setAttribute("roomName", roomName);
	newOption.setAttribute("roomID", roomID);
	newOption.textContent = `Join ${roomName}`;
	if (gameStarted) {
		newOption.disabled = true;
	}
	roomListElement.append(newOption);
}

let removeRoomOption = (roomID) => {
	let roomToRemove = document.querySelector(`.room_option_button[roomID="${roomID}"]`);
	if (!roomToRemove) {
		console.log("no room option to remove with that id");
		return;
	}
	roomToRemove.remove();
}

let makePlayerEntry = (playerName, playerID, playerTeam) => {
	let newEntry = document.createElement("div");
	newEntry.classList.add("player_entry");
	newEntry.setAttribute("playerID", playerID);
	newEntry.textContent = playerName;
	let teamBox = teamBox1;
	if (!!playerTeam && playerTeam === 2) {
		teamBox = teamBox2;
	}
	teamBox.append(newEntry);
}

let removePlayerEntry = (playerID) => {
	let playerEntry = document.querySelector(`.player_entry[playerID="${playerID}"]`);
	if (!playerEntry) {
		return;
	}
	playerEntry.remove();
}

let switchPlayerTeam = (playerID, team) => {
	let playerEntry = document.querySelector(`.player_entry[playerID="${playerID}"]`);
	let newTeamBox = (team === 1 ? teamBox1 : teamBox2);
	newTeamBox.append(playerEntry);
}

let createOverlayObject = (overlayType, gameObject) => {
	let newOverlayObject = {
		overlayType: overlayType,
		connectedObject: gameObject,
		overlayElement: document.createElement("div"),
		xLast: undefined,
		yLast: undefined,
		toBeRemoved: false,
	};
	let ovEl = newOverlayObject.overlayElement;
	ovEl.classList.add("ov_item");
	ovEl.classList.add(overlayType);
	if (overlayType === "player_name") {
		ovEl.textContent = gameObject.name;
		ovEl.classList.add("team" + gameObject.team);
	}
	else if (overlayType === "player_health_bar") {
		let healthBarInner = document.createElement("div");
		healthBarInner.classList.add("health_bar_inner");
		ovEl.classList.add("team" + gameObject.team);
		ovEl.append(healthBarInner);
	}
	else if (overlayType === "enemy_name") {
		ovEl.textContent = gameObject.subType;
	}
	else if (overlayType === "enemy_health_bar") {
		let healthBarInner = document.createElement("div");
		healthBarInner.classList.add("health_bar_inner");
		ovEl.append(healthBarInner);
	}
	else if (overlayType === "enemy_stagger_bar") {
		let staggerBarInner = document.createElement("div");
		staggerBarInner.classList.add("stagger_bar_inner");
		ovEl.append(staggerBarInner);
	}
	else if (overlayType === "plant_name") {
		ovEl.textContent = gameObject.subType;
	}
	else if (overlayType === "plant_growth_bar") {
		let growthBarInner = document.createElement("div");
		growthBarInner.classList.add("growth_bar_inner");
		ovEl.append(growthBarInner);
	}
	else if (overlayType === "plant_power_bar") {
		let powerBarInner = document.createElement("div");
		powerBarInner.classList.add("power_bar_inner");
		ovEl.append(powerBarInner);
	}
	gameObject.connectedOverlayObjects[overlayType] = newOverlayObject;
	overlayList.push(newOverlayObject);
	gameOverlay.append(ovEl);
	return newOverlayObject;
}

let compareInputFrameCount = (a, b) => {
	return a.frameCount - b.frameCount;
}

// Apply input to a player object, and return true if there were any changes (and false if not)
let applyInputToPlayer = (playerObject, playerInput) => {
	if (
		playerObject.upPressed !== playerInput.upPressed ||
		playerObject.rightPressed !== playerInput.rightPressed ||
		playerObject.downPressed !== playerInput.downPressed ||
		playerObject.leftPressed !== playerInput.leftPressed ||
		playerObject.interactPressed !== playerInput.interactPressed ||
		playerObject.reloadPressed !== playerInput.reloadPressed ||
		playerObject.flashlightPressed !== playerInput.flashlightPressed ||
		playerObject.runPressed !== playerInput.runPressed ||
		playerObject.firePressed !== playerInput.firePressed ||
		playerObject.readyPressed !== playerInput.readyPressed ||
		playerObject.xMousePosition !== playerInput.xMousePosition ||
		playerObject.yMousePosition !== playerInput.yMousePosition
	) {
		playerObject.upPressed = playerInput.upPressed;
		playerObject.rightPressed = playerInput.rightPressed;
		playerObject.downPressed = playerInput.downPressed;
		playerObject.leftPressed = playerInput.leftPressed;
		playerObject.interactPressed = playerInput.interactPressed;
		playerObject.reloadPressed = playerInput.reloadPressed;
		playerObject.flashlightPressed = playerInput.flashlightPressed;
		playerObject.runPressed = playerInput.runPressed;
		playerObject.firePressed = playerInput.firePressed;
		playerObject.readyPressed = playerInput.readyPressed;
		playerObject.xMousePosition = playerInput.xMousePosition;
		playerObject.yMousePosition = playerInput.yMousePosition;
		return true;
	}
	return false;
}

// Stats for debug info
let numRollbacks = 0;
let numResimulatedFrames = 0;
let numLargestRemoteLag = 0;

// Rollback function
let resimulateGame = () => {
	let currentResimulatedState = gameStateHistory[latestFullInputFrame];
	// Only keep inputs as long as they will be needed
	let recentPlayerInputLog = playerInputLog.filter(input => input.frameCount >= latestFullInputFrame);
	// Sort inputs by frame number
	recentPlayerInputLog.sort(compareInputFrameCount);
	// Keep track of latest input from each player
	let latestPlayerInputs = currentResimulatedState.playerList.map(player => {return {id: player.id, frameCount: latestFullInputFrame};});
	// Run the game back up to the current frame but with inputs from the input log
	let tempFrameCount = latestFullInputFrame;
	let inputLogIterator = 0;
	let nextPlayerInput = recentPlayerInputLog[inputLogIterator];
	let anyChangedInputs = false;
	while (tempFrameCount < currentFrameCount) {
		// Apply all (known) player inputs for this frame
		while (nextPlayerInput !== undefined && nextPlayerInput?.frameCount === tempFrameCount) {
			let matchingPlayer = currentResimulatedState.playerList.find(player => player.id === nextPlayerInput.id);
			if (matchingPlayer !== undefined) {
				// Check if any inputs are different than expected
				let applyResult = applyInputToPlayer(matchingPlayer, nextPlayerInput)
				anyChangedInputs = anyChangedInputs || applyResult;
				latestPlayerInputs.find(playerInput => playerInput.id === matchingPlayer.id).frameCount = tempFrameCount;
			}
			// Get next player input in the log
			inputLogIterator += 1;
			nextPlayerInput = recentPlayerInputLog[inputLogIterator];
		}
		// If any inputs (or any previous inputs) are different than what the historical game state had, resimulate it
		if (anyChangedInputs) {
			// Overwrite historical states
			gameStateHistory[tempFrameCount] = copyGameState(currentResimulatedState);
			// Run game logic
			gameLogic(currentResimulatedState);
			numResimulatedFrames += 1;
			tempFrameCount += 1;
			currentResimulatedState.frameCount = tempFrameCount;
		}
		else {
			// Just use existing historical state
			tempFrameCount += 1;
			if (gameStateHistory[tempFrameCount] !== undefined) {
				currentResimulatedState = gameStateHistory[tempFrameCount];
			}
		}
	}
	// Only change anything if any inputs were different than expected
	if (anyChangedInputs) {
		// Caught up to current frame, replace game state
		currentGameState = currentResimulatedState;
        window["cgsref"] = currentGameState;
		// Update latest full input frame
		latestPlayerInputs.sort(compareInputFrameCount);
		latestFullInputFrame = latestPlayerInputs[0]?.frameCount || latestFullInputFrame;
		numRollbacks += 1;
	}
}

let lastTime;
let timeAccumulator = 0;
let frameTime = 1000/60;
//let shouldResetToInitialState = false;
let gameLoop = () => {
	if (gameStarted && currentGameState !== undefined && !gamePaused) {

		// Do rollback simulations if needed
		if (rollbackInputReceived) {
			rollbackInputReceived = false;
			resimulateGame();
		}

		let frameTimeAdjust = 0;
		// Determine if a slight delay or skip forward is needed
		numLargestRemoteLag = Math.min(...playerFrameAdvantages.map(entry => entry.frameAdvantage));
		if (numLargestRemoteLag < -1) {
			frameTimeAdjust = 4;
			if (numLargestRemoteLag < -5) {
				frameTimeAdjust = 8;
			}
			if (numLargestRemoteLag < -10) {
				frameTimeAdjust = 16;
			}
		}

		let newTime = Date.now();
		let deltaTime = newTime - lastTime;
		lastTime = newTime;
		timeAccumulator += deltaTime;
		if (timeAccumulator > (frameTime + frameTimeAdjust)) {
			// Run logic to simulate frames of the game
			let limit = 10;
			while (timeAccumulator > frameTime && limit > 0) {
				timeAccumulator -= frameTime;
				limit -= 1;
				// Apply any playerinputs for this frame
				let playerInputsToApply = playerInputLog.filter(playerInput => playerInput.frameCount === currentFrameCount);
				playerInputsToApply.forEach(playerInput => {
					let matchingPlayer = currentGameState.playerList.find(player => player.id === playerInput.id);
					applyInputToPlayer(matchingPlayer, playerInput);
				});
				gameStateHistory.push(copyGameState(currentGameState));
				gameLogic(currentGameState);
				/*if (shouldResetToInitialState) {
					let team1Score = currentGameState.team1Score;
					let team2Score = currentGameState.team2Score;
					//currentGameState = copyGameState(initialGameStateCopy);
					currentGameState.team1Score = team1Score;
					currentGameState.team2Score = team2Score;
					shouldResetToInitialState = false;
				}*/
				currentFrameCount += 1;
				currentGameState.frameCount = currentFrameCount;
			}
			if (limit === 0) {
				timeAccumulator = 0;
			}
			// Send inputs to server, and save to input log for local game simulation in a couple frames
			if (currentView === "game" && (inputChanged || (lastInputSentFrame + 120 < currentFrameCount))) {
				// Case 1: input has changed
				// Case 2: too long since last time input was sent to server
				let inputData = {
					upPressed: wDown,
					rightPressed: dDown,
					downPressed: sDown,
					leftPressed: aDown,
					interactPressed: eDown,
					reloadPressed: rDown,
					flashlightPressed: fDown,
					runPressed: shiftDown,
					firePressed: leftMouseDown,
					readyPressed: rightMouseDown,
					xMousePosition: xMouseScreen - Math.round(window.innerWidth / 2),
					yMousePosition: yMouseScreen - Math.round(window.innerHeight / 2),
					// Input delay - this input is applied slightly later than when it's pressed
					frameCount: currentFrameCount + inputDelay,
				};
				sendData("playerInput", inputData);
				// Also put this into the local copy of the input log (the server will not send it to us)
				inputData.id = localPlayerID;
				playerInputLog.push(inputData);
				// Ok this is mostly for testing rollback
				// but if the input frame is set to be before the current frame (or the current frame), do a rollback
				// (Would only happen if there is an artifically negative inputDelay
				if (inputData.frameCount <= currentFrameCount) {
					rollbackInputReceived = true;
				}
				lastInputSentFrame = currentFrameCount;
			}
			inputChanged = false;
		}
		renderFrame(currentGameState);
	}
	else if (gamePaused) {
		// Don't build up a large chunk of time while paused
		lastTime = Date.now();
	}
	requestAnimationFrame(gameLoop);
}

let createMissingMeshes = (gameObjectList, createMeshFunc) => {
	gameObjectList.forEach(gameObject => {
		if (gameObject.connectedMesh === undefined) {
			gameObject.connectedMesh = createMeshFunc(gameObject);
			gameObject.connectedMesh.connectedObject = gameObject;
		}
	});
};

let removeUnneededMeshes = (meshList, gameObjectList) => {
	meshList.forEach(mesh => {
		// gameObject isn't in the game anymore (destroyed, or rollbacked to never exist)
		// OR, gameObject has a different mesh attached (rollback shenanigans)
		if (!gameObjectList.includes(mesh.connectedObject) || mesh.connectedObject.connectedMesh !== mesh) {
            // Remove any attached lights
			if (mesh.spotLight !== undefined) {
				scene.remove(mesh.spotLight);
				mesh.spotLight.dispose();
			}
			if (mesh.pointLight !== undefined) {
				scene.remove(mesh.pointLight);
				mesh.pointLight.dispose();
			}
			scene.remove(mesh);
			meshList.splice(meshList.indexOf(mesh), 1);
		}
	});
}

let createMissingOverlays = (overlayType, gameObjectList) => {
	gameObjectList.forEach(gameObject => {
		if (gameObject.connectedOverlayObjects[overlayType] === undefined) {
			createOverlayObject(overlayType, gameObject);
		}
	});
};

let removeUnneededOverlays = (gs) => {
	let anyRemovals = false;
	overlayList.forEach(overlayItem => {
		let connectedObject = overlayItem.connectedObject;
		let connectedObjectType = connectedObject.type;
		let gameObjectList;
		if (connectedObjectType === "player") {
			gameObjectList = gs.playerList;
		}
		else if (connectedObjectType === "enemy") {
			gameObjectList = gs.enemyList;
		}
		// Put the other object list conditionals here...
		else {
			// No object list? not sure what can be done
			return;
		}
		// gameObject has a different overlay attached for this type (rollback shenanigans?)
		if (connectedObject.connectedOverlayObjects[overlayItem.overlayType] !== overlayItem) {
			overlayItem.overlayElement.remove();
			overlayItem.toBeRemoved = true;
		}
		// gameObject isn't in the game anymore (destroyed, or rollbacked to never exist?)
		else if (!gameObjectList.includes(connectedObject)) {
			overlayItem.overlayElement.remove();
			overlayItem.toBeRemoved = true;
			connectedObject.connectedOverlayObjects[overlayItem.overlayType] = undefined;
		}
	});
	if (anyRemovals) {
		overlayList = overlayList.filter(overlayItem => !overlayItem.toBeRemoved);
	}
}

let renderFrame = (gs) => {
	// Create meshes for all objects if they haven't been made yet
	// (Done here to better support rollback)
	createMissingMeshes(gs.playerList, createPlayerMesh);
	createMissingMeshes(gs.applianceList, createApplianceMesh);
	createMissingMeshes(gs.itemList, createItemMesh);
	createMissingMeshes(gs.projectileList, createProjectileMesh);
	createMissingMeshes(gs.effectList, createEffectMesh);
	createMissingMeshes(gs.enemyList, createEnemyMesh);
	createMissingMeshes(gs.plantList, createPlantMesh);
	// Remove unused meshes
	// Check that the connected object is in the game, and that the connected object is still actually connected
	removeUnneededMeshes(playerMeshList, gs.playerList);
	removeUnneededMeshes(applianceMeshList, gs.applianceList);
	removeUnneededMeshes(itemMeshList, gs.itemList);
	removeUnneededMeshes(projectileMeshList, gs.projectileList);
	removeUnneededMeshes(effectMeshList, gs.effectList);
	removeUnneededMeshes(enemyMeshList, gs.enemyList);
	removeUnneededMeshes(plantMeshList, gs.plantList);
	// Update rendering position, rotation, material, etc for all objects
	gs.applianceList.forEach(applianceObject => {
		let applianceMesh = applianceObject.connectedMesh;
		applianceMesh.position.x = applianceObject.xPosition;
		applianceMesh.position.y = applianceObject.yPosition;
		if (applianceObject.subType === "lamp") {
			applianceMesh.position.z = 1.5;
            if (applianceObject.lightOn) {
                applianceMesh.pointLight.intensity = 0.4;
            }
            else {
                applianceMesh.pointLight.intensity = 0;
            }
		}
		else if (applianceObject.subType === "wall") {
			applianceMesh.position.z = 0.5;
		}
	});
	let localPlayer = getLocalPlayer(gs);
	let localPlayerMesh = localPlayer.connectedMesh;
	gs.playerList.forEach(playerObject => {
		let playerMesh = playerObject.connectedMesh;
		playerMesh.position.x = playerObject.xPosition;
		playerMesh.position.y = playerObject.yPosition;
		playerMesh.position.z = 0.25;
		playerMesh.rotation.z = playerObject.rotation;
        if (playerObject.defeated) {
			if (playerObject.team === 1) {
				playerMesh.material = playerTeam1DefeatedMaterial;
			}
			else if (playerObject.team === 1) {
				playerMesh.material = playerTeam2DefeatedMaterial;
			}
            playerMesh.castShadow = false;
            playerMesh.receiveShadow = false;
        }
        else {
			if (playerObject.team === 1) {
				playerMesh.material = playerTeam1Material;
			}
			else if (playerObject.team === 1) {
				playerMesh.material = playerTeam2Material;
			}
            playerMesh.castShadow = true;
            playerMesh.receiveShadow = true;
        }
        if (playerObject === localPlayer) {
            gs.applianceList.forEach(applianceObject => {
                if (playerObject.xTarget === applianceObject.xPosition &&
                    playerObject.yTarget === applianceObject.yPosition) {
                    applianceObject.connectedMesh.material = applianceObject.highlightMat;
                }
                else {
                    applianceObject.connectedMesh.material = applianceObject.regularMat;
                }
            });
        }
		if (playerObject.flashlightOn) {
			playerMesh.spotLight.intensity = 1;
		}
		else {
			playerMesh.spotLight.intensity = 0;
		}
		if (playerObject.itemCooldown > 4) {
			playerMesh.pointLight.intensity = 1;
		}
		else {
			playerMesh.pointLight.intensity = 0;
		}
	});
	gs.itemList.forEach(itemObject => {
		let itemMesh = itemObject.connectedMesh;
		if (itemObject.holder !== undefined) {
			itemMesh.parent = itemObject.holder.connectedMesh;
		}
		// Held by player or appliance
		if (itemObject.heldByPlayer) {
			itemMesh.position.set(1, 0, 0.5);
			if (itemObject.fixedRotation) {
				itemMesh.rotation.z = itemObject.holder.rotation * -1;
			}
			else {
				itemMesh.rotation.z = itemObject.initialRotation;
			}
		}
		else if (itemObject.heldByAppliance) {
			itemMesh.position.set(0, 0, 1);
			itemMesh.rotation.z = itemObject.initialRotation;
		}
		else if (itemObject.heldByPlant) {
			itemMesh.position.set(0, 0, 1);
			itemMesh.rotation.z = itemObject.initialRotation;
		}
		// Change material when progress is made
		if (itemObject.processed) {
			itemMesh.material = itemMaterial2;
		}
	});
	gs.projectileList.forEach(projectileObject => {
		let projectileMesh = projectileObject.connectedMesh;
		projectileMesh.position.x = projectileObject.xPosition;
		projectileMesh.position.y = projectileObject.yPosition;
		projectileMesh.rotation.z = projectileObject.rotation;
	});
	gs.effectList.forEach(effectObject => {
		let effectMesh = effectObject.connectedMesh;
		effectMesh.scale.x = (50 - effectObject.lifespan) / 70;
		effectMesh.scale.y = (50 - effectObject.lifespan) / 70;
		effectMesh.position.x = effectObject.xPosition;
		effectMesh.position.y = effectObject.yPosition;
	});
	gs.enemyList.forEach(enemyObject => {
		let enemyMesh = enemyObject.connectedMesh;
		enemyMesh.position.x = enemyObject.xPosition;
		enemyMesh.position.y = enemyObject.yPosition;
		enemyMesh.rotation.z = enemyObject.rotation;
		if (enemyObject.state === "defeat") {
			enemyMesh.scale.x = ((61 - enemyObject.stateTimer) / 60);
			enemyMesh.scale.y = ((61 - enemyObject.stateTimer) / 60);
			enemyMesh.scale.z = ((61 - enemyObject.stateTimer) / 60);
		}
		else {
			enemyMesh.scale.x = 1;
			enemyMesh.scale.y = 1;
			enemyMesh.scale.z = 1;
		}
		if (enemyObject.state === "attack") {
			enemyMesh.material = enemy1AttackMaterial;
		}
		else if (enemyObject.state === "stunned") {
			enemyMesh.material = enemy1StunnedMaterial;
		}
		else if (enemyObject.state === "angry") {
			enemyMesh.material = enemy1AngryMaterial;
		}
		else {
			enemyMesh.material = enemy1Material;
		}
	});
	gs.plantList.forEach(plantObject => {
		let plantMesh = plantObject.connectedMesh;
		plantMesh.position.x = plantObject.xPosition;
		plantMesh.position.y = plantObject.yPosition;
	});
	// Third person overhead camera
	camera.position.set(localPlayerMesh.position.x, localPlayerMesh.position.y, localPlayerMesh.position.z + 10);
	localPlayerMesh.visible = true;
	camera.rotation.set(0, 0, 0);
	if (false) {
		// Old overhead view
		localPlayerMesh.visible = true;
		camera.rotation.set(0, 0, 0);
		let xMin = gs.playerList.reduce((x, object) => Math.min(object.xPosition, x), Infinity);
		xMin = Math.min(xMin, gs.applianceList.reduce((x, object) => Math.min(object.xPosition, x), Infinity));

		let xMax = gs.playerList.reduce((x, object) => Math.max(object.xPosition, x), -Infinity);
		xMax = Math.max(xMax, gs.applianceList.reduce((x, object) => Math.max(object.xPosition, x), -Infinity));

		let yMin = gs.playerList.reduce((y, object) => Math.min(object.yPosition, y), Infinity);
		yMin = Math.min(yMin, gs.applianceList.reduce((y, object) => Math.min(object.yPosition, y), Infinity));

		let yMax = gs.playerList.reduce((y, object) => Math.max(object.yPosition, y), -Infinity);
		yMax = Math.max(yMax, gs.applianceList.reduce((y, object) => Math.max(object.yPosition, y), -Infinity));

		let sceneSize = Math.max(Math.abs(xMax - xMin), Math.abs(yMax - yMin));

		let xCamTarget = (xMin + xMax) / 2;
		let yCamTarget = (yMin + yMax) / 2;
		let zCamTarget = 5 + sceneSize * 0.5;
		xCamera = 0.9 * xCamera + 0.1 * xCamTarget;
		yCamera = 0.9 * yCamera + 0.1 * yCamTarget;
		zCamera = 0.9 * zCamera + 0.1 * zCamTarget;
		camera.position.x = xCamera;
		camera.position.y = yCamera;
		camera.position.z = zCamera;
	}
	// Actually render the 3d scene
	renderer.render(scene, camera);
	// Create overlays for all objects that need them
	// Player overlays
	createMissingOverlays("player_name", gs.playerList);
	createMissingOverlays("player_health_bar", gs.playerList);
	// Enemy overlays
	createMissingOverlays("enemy_name", gs.enemyList);
	createMissingOverlays("enemy_health_bar", gs.enemyList);
	createMissingOverlays("enemy_stagger_bar", gs.enemyList);
	// Plant overlays
	createMissingOverlays("plant_name", gs.plantList);
	createMissingOverlays("plant_growth_bar", gs.plantList);
	createMissingOverlays("plant_power_bar", gs.plantList);
	// Remove unneeded overlays
	removeUnneededOverlays(gs);
	// Update overlays
	overlayList.forEach(overlayItem => {
		let overlayElement = overlayItem.overlayElement;
		let trackTarget = overlayItem.connectedObject.connectedMesh;
		let coords = meshToScreenCoordinates(trackTarget);
		if (overlayItem.xLast !== coords.x || overlayItem.yLast !== coords.y) {
			overlayElement.style.setProperty("--x-pos", coords.x + "px");
			overlayElement.style.setProperty("--y-pos", coords.y + "px");
			overlayItem.xLast = coords.x;
			overlayItem.yLast = coords.y;
		}
		if (overlayItem.overlayType === "player_health_bar" || overlayItem.overlayType === "enemy_health_bar") {
			let displayedHealth = overlayElement.style.getPropertyValue("--health");
			let displayedMaxHealth = overlayElement.style.getPropertyValue("--max-health");
			// Using != because the dom saves these as strings instead of numbers
			if (overlayItem.connectedObject.health != displayedHealth || overlayItem.connectedObject.maxHealth != displayedMaxHealth) {
				overlayElement.style.setProperty("--health", Math.min(Math.max(0, overlayItem.connectedObject.health), overlayItem.connectedObject.maxHealth));
				overlayElement.style.setProperty("--max-health", overlayItem.connectedObject.maxHealth);
			}
		}
		if (overlayItem.overlayType === "enemy_stagger_bar") {
			let displayedStagger = overlayElement.style.getPropertyValue("--stagger");
			let displayedMaxStagger = overlayElement.style.getPropertyValue("--max-stagger");
			// Using != because the dom saves these as strings instead of numbers
			if (overlayItem.connectedObject.stagger != displayedStagger || overlayItem.connectedObject.maxStagger != displayedMaxStagger) {
				overlayElement.style.setProperty("--stagger", Math.min(Math.max(0, overlayItem.connectedObject.stagger), overlayItem.connectedObject.maxStagger));
				overlayElement.style.setProperty("--max-stagger", overlayItem.connectedObject.maxStagger);
			}
		}
		if (overlayItem.overlayType === "plant_growth_bar") {
			let displayedGrowth = overlayElement.style.getPropertyValue("--growth");
			let displayedMaxGrowth = overlayElement.style.getPropertyValue("--max-growth");
			// Using != because the dom saves these as strings instead of numbers
			if (overlayItem.connectedObject.growth != displayedGrowth || overlayItem.connectedObject.maxGrowth != displayedMaxGrowth) {
				overlayElement.style.setProperty("--growth", Math.min(Math.max(0, overlayItem.connectedObject.growth), overlayItem.connectedObject.maxGrowth));
				overlayElement.style.setProperty("--max-growth", overlayItem.connectedObject.maxGrowth);
			}
		}
		if (overlayItem.overlayType === "plant_power_bar") {
			let displayedPower = overlayElement.style.getPropertyValue("--power");
			let displayedMaxPower = overlayElement.style.getPropertyValue("--max-power");
			// Using != because the dom saves these as strings instead of numbers
			if (overlayItem.connectedObject.power != displayedPower || overlayItem.connectedObject.maxPower != displayedMaxPower) {
				overlayElement.style.setProperty("--power", Math.min(Math.max(0, overlayItem.connectedObject.power), overlayItem.connectedObject.maxPower));
				overlayElement.style.setProperty("--max-power", overlayItem.connectedObject.maxPower);
			}
		}
	});
	if (showDebug) {
		currentFrameSpan.textContent = currentFrameCount;
		rollbacksSpan.textContent = numRollbacks;
		resimulatedFramesSpan.textContent = numResimulatedFrames;
		largestRemoteLagSpan.textContent = numLargestRemoteLag;
	}
    if (gs.gameFinished) {
        gameStatusMessageSpan.textContent = `Game finished, Team ${gs.gameWinner} won!`;
    }
    else if (gs.gameActive) {
        gameStatusMessageSpan.textContent = "Round in progress";
    }
    else {
        gameStatusMessageSpan.textContent = `Round over, Team ${gs.roundWinner} wins. Next round in ${Math.round(gs.roundEndCountdown / 60)}.`;
    }
    team1ScoreSpan.textContent = gs.team1Score;
    team2ScoreSpan.textContent = gs.team2Score;
}

let getLocalPlayer = (gs) => {
	return gs.playerList.filter(player => player.id === localPlayerID)[0];
}

let collisionTest = (object1, object2) => {
	let xDif = Math.abs(object1.xPosition - object2.xPosition);
	let yDif = Math.abs(object1.yPosition - object2.yPosition);
	return (xDif < 0.5 && yDif < 0.5);
}

let gameLogic = (gs) => {
	// Effects can change even while game is otherwise paused for between-round pauses
	let anyEffectRemovals = false;
	gs.effectList.forEach(effectObject => {
		effectObject.lifespan -= 1;
		if (effectObject.lifespan <= 0) {
			effectObject.toBeRemoved = true;
			anyEffectRemovals = true;
		}
	});
	if (anyEffectRemovals) {
		gs.effectList.filter(effectObject => effectObject.toBeRemoved).forEach(effectObject => {removeEffect(gs, effectObject);});
	}
	// Freeze the game if done or between rounds
    if (gs.gameFinished) {
        return;
    }
    if (!gs.gameActive) {
        gs.roundEndCountdown -= 1;
        if (gs.roundEndCountdown <= 0) {
            gs.gameActive = true;
			// Reset game to initial state
			//shouldResetToInitialState = true;
			// TODO: Remove all held items from players and appliances besides supply tables
			// TODO: Reset lamps 
			gs.applianceList.forEach(applianceObject => {
				if (applianceObject.holdingItem && applianceObject.subType !== "supply") {
					transferItem(gs, applianceObject, undefined, applianceObject.heldItem);
				}
				if (applianceObject.subType === "lamp") {
					applianceObject.lightOn = true;
				}
			});
			// TODO: Set players locations back to initial starting point
			// TODO: Set players health and other stats back to initial values. flashlight off, etc
			gs.playerList.forEach(playerObject => {
				if (playerObject.holdingItem) {
					transferItem(gs, playerObject, undefined, playerObject.heldItem);
				}
				resetPlayerObject(playerObject);
			});
			// TODO: Remove all projectiles, effects
			gs.projectileList.forEach(projectileObject => {
				projectileObject.toBeRemoved = true;
			});
			gs.effectList.forEach(projectileObject => {
				projectileObject.toBeRemoved = true;
			});
        }
        return;
    }
	let anyRemovals = false;
    // Tracking defeated players for their team's victory/defeat
    let team2AllDefeated = true;
    let team2AnyPlayers = false;
    let team1AllDefeated = true;
    let team1AnyPlayers = false;
	gs.playerList.forEach(playerObject => {
		// Player Movement
		let xSpeedChange = 0;
		let ySpeedChange = 0;
		if (playerObject.upPressed) {
			ySpeedChange += 0.02;
		}
		if (playerObject.leftPressed) {
			xSpeedChange -= 0.02;
		}
		if (playerObject.downPressed) {
			ySpeedChange -= 0.02;
		}
		if (playerObject.rightPressed) {
			xSpeedChange += 0.02;
		}
        if (playerObject.runPressed && !playerObject.readyPressed) {
            xSpeedChange *= 1.7;
            ySpeedChange *= 1.7;
        }
		// Defeated players are very slow
		//if (playerObject.defeated) {
			//xSpeedChange *= 0.1;
			//ySpeedChange *= 0.1;
		//}
		// Diagonal movement
		if (xSpeedChange !== 0 && ySpeedChange !== 0) {
			xSpeedChange /= Math.SQRT2;
			ySpeedChange /= Math.SQRT2;
		}
		let anyDirectionPressed = (xSpeedChange !== 0 || ySpeedChange !== 0);
		let rotationChange = 0;
		let targetRotation;
		if (playerObject.readyPressed) {
			// Player is trying to ready a weapon - point toward mouse instead
			targetRotation = -Math.atan2(playerObject.yMousePosition, playerObject.xMousePosition);
            playerObject.movedMouseWhileStill = false;
		}
		else if (anyDirectionPressed) {
			// Player is just moving around without trying to ready a weapon
			targetRotation = Math.atan2(ySpeedChange, xSpeedChange);
            playerObject.movedMouseWhileStill = false;
		}
        else {
            // Player is not moving or readying a weapon
            // If mouse moved, point toward mouse. Otherwise keep current rotation
            if (playerObject.xMousePosition !== playerObject.xMousePrevPosition ||
                playerObject.yMousePosition !== playerObject.yMousePrevPosition) {
                playerObject.movedMouseWhileStill = true;
            }
            if (playerObject.movedMouseWhileStill) {
                targetRotation = -Math.atan2(playerObject.yMousePosition, playerObject.xMousePosition);
            }
            else {
                targetRotation = playerObject.rotation;
            }
        }
		let oppositeRotation = false;
		if (anyDirectionPressed || playerObject.readyPressed || playerObject.movedMouseWhileStill) {
			if (playerObject.rotation !== targetRotation) {
				let targetRotationDifference = Math.abs(playerObject.rotation - targetRotation);
				// Apply spin to player's rotation toward targetRotation
				if (playerObject.rotation > targetRotation) {
					rotationChange -= 0.17;
				}
				else {
					rotationChange += 0.17;
				}
				// If the target rotation difference is greater than pi, spin the opposite way
				if (targetRotationDifference > Math.PI) {
					rotationChange *= -1;
					oppositeRotation = true;
				}
			}
		}
		let previousRotation = playerObject.rotation;
		if (rotationChange !== 0) {
			// Defeated players turn slower
			//if (playerObject.defeated) {
				//rotationChange *= 0.5;
			//}
			// Apply rotation
			playerObject.rotation += rotationChange;
			// Don't overshoot the targetRotation
			if (oppositeRotation) {
				if ((rotationChange > 0 && playerObject.rotation < targetRotation) || (rotationChange < 0 && playerObject.rotation > targetRotation)) {
					playerObject.rotation = targetRotation; 
				}
			}
			else {
				if ((rotationChange > 0 && playerObject.rotation > targetRotation) || (rotationChange < 0 && playerObject.rotation < targetRotation)) {
					playerObject.rotation = targetRotation; 
				}
			}
			// Loop around the pi to negative pi limit
			if (playerObject.rotation > Math.PI) {
				playerObject.rotation -= Math.PI * 2;
				previousRotation -= Math.PI * 2;
				if (playerObject.rotation > targetRotation) {
					playerObject.rotation = targetRotation;
				}
			}
			if (playerObject.rotation < -Math.PI) {
				playerObject.rotation += Math.PI * 2;
				previousRotation += Math.PI * 2;
				if (playerObject.rotation < targetRotation) {
					playerObject.rotation = targetRotation;
				}
			}
		}
		// If turning, slow down movement
		/*let rotationDifference = Math.abs(previousRotation - playerObject.rotation);
		if (rotationDifference > 0.01) {
			xSpeedChange *= 0.5;
			ySpeedChange *= 0.5;
		}*/
		// Don't move while holding space
		//if (!playerObject.anchorPressed) {
			//playerObject.xSpeed += xSpeedChange;
			//playerObject.ySpeed += ySpeedChange;
		//}
		// Slow down if trying to ready a weapon
		if (playerObject.readyPressed) {
			xSpeedChange *= 0.5;
			ySpeedChange *= 0.5;
		}
		playerObject.xSpeed += xSpeedChange;
		playerObject.ySpeed += ySpeedChange;
		// Check for appliances in the way
		let xPotential = playerObject.xPosition + playerObject.xSpeed;
		let yPotential = playerObject.yPosition + playerObject.ySpeed;
		let playerSize = 0.8;
		// Skip lamps
		gs.applianceList.filter(appliance => appliance.subType !== "lamp").forEach(appliance => {
			if (Math.abs(appliance.xPosition - xPotential) <= playerSize &&
				Math.abs(appliance.yPosition - yPotential) <= playerSize) {
				let xAppDif = Math.abs(playerObject.xPosition - appliance.xPosition);
				let yAppDif = Math.abs(playerObject.yPosition - appliance.yPosition);
				if (xAppDif > yAppDif) {
					// Left or right side
					if (playerObject.xPosition > appliance.xPosition) {
						// Right side
						// Make sure appliance's right side isn't covered by another appliance
						let rightSideCovered = gs.applianceList.some(otherAppliance => {
							return otherAppliance.xPosition === appliance.xPosition + 1 &&
								otherAppliance.yPosition === appliance.yPosition;
						});
						if (!rightSideCovered) {
							playerObject.xSpeed = Math.max(playerObject.xSpeed, playerSize + appliance.xPosition - playerObject.xPosition);
						}
					}
					else {
						// Left side
						// Make sure appliance's right side isn't covered by another appliance
						let leftSideCovered = gs.applianceList.some(otherAppliance => {
							return otherAppliance.xPosition === appliance.xPosition - 1 &&
								otherAppliance.yPosition === appliance.yPosition;
						});
						if (!leftSideCovered) {
							playerObject.xSpeed = Math.min(playerObject.xSpeed, -playerSize + appliance.xPosition - playerObject.xPosition);
						}
					}
				}
				else {
					// Top or bottom side
					if (playerObject.yPosition > appliance.yPosition) {
						// Bottom side
						// Make sure appliance's bottom side isn't covered by another appliance
						let bottomSideCovered = gs.applianceList.some(otherAppliance => {
							return otherAppliance.xPosition === appliance.xPosition &&
								otherAppliance.yPosition === appliance.yPosition + 1;
						});
						if (!bottomSideCovered) {
							playerObject.ySpeed = Math.max(playerObject.ySpeed, playerSize + appliance.yPosition - playerObject.yPosition);
						}
					}
					else {
						// Top side
						// Make sure appliance's right side isn't covered by another appliance
						let topSideCovered = gs.applianceList.some(otherAppliance => {
							return otherAppliance.xPosition === appliance.xPosition &&
								otherAppliance.yPosition === appliance.yPosition - 1;
						});
						if (!topSideCovered) {
							playerObject.ySpeed = Math.min(playerObject.ySpeed, -playerSize + appliance.yPosition - playerObject.yPosition);
						}
					}
				}
			}
		});
		playerObject.xPosition += playerObject.xSpeed;
		playerObject.yPosition += playerObject.ySpeed;
		playerObject.xSpeed *= 0.75;
		playerObject.ySpeed *= 0.75;
		// Apply more friction if stopping
		if (!anyDirectionPressed) {
			playerObject.xSpeed *= 0.8;
			playerObject.ySpeed *= 0.8;
		}
		playerObject.xTarget = Math.round(playerObject.xPosition + Math.cos(playerObject.rotation));
		playerObject.yTarget = Math.round(playerObject.yPosition + Math.sin(playerObject.rotation));

		if (playerObject.itemCooldown > 0) {
			playerObject.itemCooldown -= 1;
		}
		// World Interaction
		let doInteraction = false;
		let doFire = false;
		if (playerObject.interactPressed) {
			if (playerObject.interactReleased) {
				doInteraction = true;
			}
			playerObject.interactReleased = false;
		}
		else {
			playerObject.interactReleased = true;
		}
		if (playerObject.firePressed) {
			if (playerObject.fireReleased) {
				if (playerObject.readyPressed && playerObject.holdingItem) {
					doFire = true;
				}
				else {
					doInteraction = true;
				}
			}
			playerObject.fireReleased = false;
		}
		else {
			playerObject.fireReleased = true;
		}
		if (doInteraction) {
			// Either: interact button pressed, or fire button pressed without ready button pressed, or fire button pressed without item in hand
			// Grab input: try to grab or put down an item
			// Grab from appliances
			gs.applianceList.forEach((applianceObject) => {
				if (playerObject.xTarget === applianceObject.xPosition && playerObject.yTarget === applianceObject.yPosition) {
					// Supply appliances - copy item when picking up, delete item when putting down, never remove item from supply
					// Can only put item down onto same type of supply
					if (applianceObject.subType === "supply") {
						if (playerObject.holdingItem && applianceObject.holdingItem && playerObject.heldItem.subType === applianceObject.heldItem.subType) {
							// Delete player's held item
							transferItem(gs, playerObject, undefined, playerObject.heldItem);
						}
						else if (!playerObject.holdingItem && applianceObject.holdingItem) {
							// Pick up copy of item
							let newItem = createItem(gs, applianceObject.heldItem.subType);
							transferItem(gs, undefined, playerObject, newItem);
						}
					}
                    else if (applianceObject.subType === "lamp") {
                        // Lamps: No items picked up or put down from, but can toggle light
                        applianceObject.lightOn = !applianceObject.lightOn;
                    }
                    else if (applianceObject.subType === "wall") {
						// Walls: No interaction
                    }
					else {
						if (playerObject.holdingItem && !applianceObject.holdingItem) {
							// Put down object
							transferItem(gs, playerObject, applianceObject, playerObject.heldItem);
						}
						else if (!playerObject.holdingItem && applianceObject.holdingItem) {
							// Pick up object
							transferItem(gs, applianceObject, playerObject, applianceObject.heldItem);
						}
					}
				}
			});
			// Grab from plants and interact with specific items
			gs.plantList.forEach(plantObject => {
				if (playerObject.xTarget === plantObject.xPosition && playerObject.yTarget === plantObject.yPosition) {
					// Can only take from plant, not put arbitrary items back down
					if (!playerObject.holdingItem && plantObject.holdingItem) {
						// Pick up object
						transferItem(gs, plantObject, playerObject, plantObject.heldItem);
					}
				}
			});
		}
		if (doFire) {
			// Fire button: Use held item (or make progress on something? probably remove that part)
			if (playerObject.holdingItem && playerObject.heldItem.hasAbility) {
				// Use ability of item
				// Defeated players cannot fire projectiles
				// Player must not have cooldown remaining
				if (!playerObject.defeated && playerObject.itemCooldown <= 0) {
					let abilityType = playerObject.heldItem.subType;
					let projectileType;
					if (abilityType === "gun") {
						projectileType = "bullet";
					}
					else if (abilityType === "sword") {
						projectileType = "swordSwing";
					}
					else if (abilityType === "ball") {
						projectileType = "thrownBall";
					}
					else if (abilityType === "fireBomb") {
						projectileType = "fireBombToss";
					}
					let projectileObject = createProjectile(gs, projectileType, playerObject.xPosition, playerObject.yPosition, playerObject.rotation, 0.4);
					projectileObject.sourcePlayer = playerObject;
					playerObject.itemCooldown = 8;
				}
			}
			else {
				// Interact button: can make progress on item
				gs.applianceList.forEach((applianceObject) => {
					if (applianceObject.holdingItem) {
						if (playerObject.xTarget === applianceObject.xPosition && playerObject.yTarget === applianceObject.yPosition) {
							let targetItem = applianceObject.heldItem;
							if (!targetItem.processed) {
								let progressAmt = 1;
								// defeated players cannot make progress
								if (playerObject.defeated) {
									progressAmt = 0;
								}
								targetItem.progress += progressAmt;
							}
							if (targetItem.progress >= 100) {
								targetItem.processed = true;
							}
						}
					}
				});
			}
		}
		if (playerObject.flashlightPressed) {
			if (playerObject.flashlightReleased) {
				playerObject.flashlightOn = !playerObject.flashlightOn;
			}
			playerObject.flashlightReleased = false;
		}
		else {
			playerObject.flashlightReleased = true;
		}
        // Update previous mouse position to the current position
        playerObject.xMousePrevPosition = playerObject.xMousePosition;
        playerObject.yMousePrevPosition = playerObject.yMousePosition;
        // Track team defeated status
        if (playerObject.team === 1) {
            team1AnyPlayers = true;
            if (!playerObject.defeated) {
                team1AllDefeated = false;
            }
        }
        if (playerObject.team === 2) {
            team2AnyPlayers = true;
            if (!playerObject.defeated) {
                team2AllDefeated = false;
            }
        }
	});
	gs.enemyList.forEach(enemyObject => {
		// Enemy states: idle, chase, attack, stunned, angry
		if (enemyObject.state === "idle") {
			enemyObject.stateTimer += 1;
			if (enemyObject.stateTimer > 10) {
				// Pick a player to chase
				let potentialTargetPlayer = gs.playerList[Math.floor(deterministicRandom(gs) * gs.playerList.length)];
				if (potentialTargetPlayer !== undefined) {
					enemyObject.targetPlayer = potentialTargetPlayer;
					enemyObject.state = "chase";
					enemyObject.stateTimer = 0;
				}
			}
		}
		else if (enemyObject.state === "chase") {
			let angleToTarget = Math.atan2(
				enemyObject.targetPlayer.yPosition - enemyObject.yPosition,
				enemyObject.targetPlayer.xPosition - enemyObject.xPosition
			);
			let xSpeedChange = Math.cos(angleToTarget) * 0.004;
			let ySpeedChange = Math.sin(angleToTarget) * 0.004;
			enemyObject.xSpeed += xSpeedChange;
			enemyObject.ySpeed += ySpeedChange;
			enemyObject.rotation = angleToTarget;
			let xDist = Math.abs(enemyObject.targetPlayer.xPosition - enemyObject.xPosition);
			let yDist = Math.abs(enemyObject.targetPlayer.yPosition - enemyObject.yPosition);
			if (xDist < 4.5 && yDist < 4.5) {
				enemyObject.state = "attack";
				enemyObject.stateTimer = 0;
			}
		}
		else if (enemyObject.state === "attack") {
			enemyObject.stateTimer += 1;
			if (enemyObject.stateTimer % 20 === 0) {
				let projectileObject = createProjectile(gs, "swordSwing", enemyObject.xPosition, enemyObject.yPosition, enemyObject.rotation, 0.1);
				projectileObject.sourceIsEnemy = true;
			}
			if (enemyObject.stateTimer > 62) {
				enemyObject.state = "idle";
				enemyObject.stateTimer = 0;
			}
		}
		else if (enemyObject.state === "stunned") {
			enemyObject.stateTimer += 1;
			if (enemyObject.stateTimer > 90) {
				enemyObject.state = "angry";
				enemyObject.stateTimer = 0;
				enemyObject.stagger = 0;
			}
		}
		else if (enemyObject.state === "angry") {
			enemyObject.stateTimer += 1;
			enemyObject.stagger = 0;
			if (enemyObject.stateTimer % 11 === 0) {
				// Straight
				let projectileObject1 = createProjectile(gs, "swordSwing", enemyObject.xPosition, enemyObject.yPosition, enemyObject.rotation, 0.1);
				projectileObject1.sourceIsEnemy = true;
				// Angled Left
				let rotation2 = wrapRotationToPiBounds(enemyObject.rotation + 0.23);
				let projectileObject2 = createProjectile(gs, "swordSwing", enemyObject.xPosition, enemyObject.yPosition, rotation2, 0.1);
				projectileObject2.sourceIsEnemy = true;
				// Angled Right
				let rotation3 = wrapRotationToPiBounds(enemyObject.rotation - 0.23);
				let projectileObject3 = createProjectile(gs, "swordSwing", enemyObject.xPosition, enemyObject.yPosition, rotation3, 0.1);
				projectileObject3.sourceIsEnemy = true;
			}
			if (enemyObject.stateTimer > 100) {
				enemyObject.state = "idle";
				enemyObject.stateTimer = 0;
			}
		}
		else if (enemyObject.state === "defeat") {
			enemyObject.stateTimer += 1;
			if (enemyObject.stateTimer > 60) {
				enemyObject.toBeRemoved = true;
			}
		}
		enemyObject.xPosition += enemyObject.xSpeed;
		enemyObject.yPosition += enemyObject.ySpeed;
		enemyObject.xSpeed *= 0.8;
		enemyObject.ySpeed *= 0.8;

		// Reduce stagger
		if (enemyObject.state !== "stunned") {
			enemyObject.stagger *= 0.995;
		}
		
		// Change state on conditions
		if (enemyObject.stagger > enemyObject.maxStagger && !enemyObject.defeated && enemyObject.state !== "stunned") {
			enemyObject.state = "stunned";
			enemyObject.stateTimer = 0;
		}
		if (enemyObject.defeated || enemyObject.health <= 0) {
			enemyObject.defeated = true;
			if (enemyObject.state !== "defeat") {
				enemyObject.state = "defeat";
				enemyObject.stateTimer = 0;
			}
		}
	});
	// Spawn more enemies over time
	/*if (gs.enemyList.length < 30 && gs.frameCount % 1400 === 0) {
		let randAngle = (deterministicRandom(gs) * 2 - 1) * Math.PI;
		let xSpot = Math.cos(randAngle) * 20;
		let ySpot = Math.sin(randAngle) * 20;
		let newEnemy = createEnemy(gs, "enemy1", xSpot, ySpot);
	}*/
	gs.plantList.forEach(plantObject => {
		// Plants 
		// Grow over time
		if (!plantObject.doneGrowing) {
			// About 30 seconds?
			//plantObject.growth += 0.005;
			plantObject.growth += 0.1;
			// At full growth, create product item as held item
			if (!plantObject.producedItem && !plantObject.holdingItem && plantObject.growth > plantObject.maxGrowth) {
				plantObject.producedItem = true;
				plantObject.doneGrowing = true;
				let newItemCopy = createItem(gs, "sword");
				transferItem(gs, undefined, plantObject, newItemCopy);
			}
		}
	});
	gs.projectileList.forEach(projectileObject => {
		// Apply speed
		projectileObject.xPosition += Math.cos(projectileObject.rotation) * projectileObject.speed;
		projectileObject.yPosition += Math.sin(projectileObject.rotation) * projectileObject.speed;
		// Test collisions against players
		gs.playerList.forEach(playerObject => {
            if (playerObject.defeated) {
                return;
            }
			if (projectileObject.sourcePlayer !== playerObject && collisionTest(playerObject, projectileObject)) {
				// Subtract 1 health from player
				playerObject.health -= 1;
				// Check if player is defeated
				if (playerObject.health <= 0) {
					playerObject.defeated = true;
                    // Make a bunch of hit effects to show that the player is defeated
                    createEffect(gs, "hit", playerObject.xPosition, playerObject.yPosition);
                    createEffect(gs, "hit", playerObject.xPosition - 0.5, playerObject.yPosition);
                    createEffect(gs, "hit", playerObject.xPosition + 0.5, playerObject.yPosition);
                    createEffect(gs, "hit", playerObject.xPosition, playerObject.yPosition - 0.5);
                    createEffect(gs, "hit", playerObject.xPosition, playerObject.yPosition + 0.5);
				}
				// Create hit effect
				createEffect(gs, "hit", projectileObject.xPosition, projectileObject.yPosition);
				// Remove projectile
				projectileObject.toBeRemoved = true;
				anyRemovals = true;
			}
		});
		// Test collisions against enemies
		gs.enemyList.forEach(enemyObject => {
			// Check that the projectile is from a player, and collides with the enemy, and the enemy isn't already defeated
			if (!projectileObject.sourceIsEnemy && collisionTest(enemyObject, projectileObject) && !enemyObject.defeated) {
				// Subtract health from enemy
				enemyObject.health -= 1;
				// Add stagger to enemy
				enemyObject.stagger += 3;
				// Check if defeated
				if (enemyObject.health <= 0) {
					enemyObject.defeated = true;
				}
				// Create hit effect
				createEffect(gs, "hit", projectileObject.xPosition, projectileObject.yPosition);
				// Remove projectile
				projectileObject.toBeRemoved = true;
				anyRemovals = true;
			}
		});
		// Test collisions against walls
		gs.applianceList.filter(applianceObject => applianceObject.subType === "wall").forEach(applianceObject => {
			if (collisionTest(applianceObject, projectileObject)) {
				// Create hit effect
				createEffect(gs, "hit", projectileObject.xPosition, projectileObject.yPosition);
				// Remove projectile
				projectileObject.toBeRemoved = true;
				anyRemovals = true;
			}
		});
		// Reduce lifespan and remove if time is up
		projectileObject.lifespan -= 1;
		if (projectileObject.lifespan <= 0) {
			projectileObject.toBeRemoved = true;
			anyRemovals = true;
		}
	});
	gs.enemyList.forEach(enemyObject => {
		if (enemyObject.toBeRemoved) {
			anyRemovals = true;
		}
	});
	gs.itemList.forEach(itemObject => {
		if (itemObject.toBeRemoved) {
			anyRemovals = true;
		}
	});
	// Removal loops
	if (anyRemovals) {
		gs.playerList.filter(playerObject => playerObject.toBeRemoved).forEach(playerObject => {removePlayer(gs, playerObject);});
		gs.projectileList.filter(projectileObject => projectileObject.toBeRemoved).forEach(projectileObject => {removeProjectile(gs, projectileObject);});
		gs.applianceList.filter(applianceObject => applianceObject.toBeRemoved).forEach(applianceObject => {removeAppliance(gs, applianceObject);});
		gs.itemList.filter(itemObject => itemObject.toBeRemoved).forEach(itemObject => {removeItem(gs, itemObject);});
		// effects are dealt with earlier
		//gs.effectList.filter(effectObject => effectObject.toBeRemoved).forEach(effectObject => {removeEffect(gs, effectObject);});
		gs.enemyList.filter(enemyObject => enemyObject.toBeRemoved).forEach(enemyObject => {removeEnemy(gs, enemyObject);});
	}
    // Check for victory conditions
    let team1Win = false;
    let team2Win = false;
    if (team1AnyPlayers && team1AllDefeated) {
        team2Win = true;
    }
    if (team2AnyPlayers && team2AllDefeated) {
        team1Win = true;
    }
    if (team1Win || team2Win) {
        gs.gameActive = false;
        if (team1Win && !team2Win) {
            gs.roundWinner = 1;
            gs.team1Score += 1;
            if (gs.team1Score >= 3) {
                gs.gameFinished = true;
                gs.gameWinner = 1;
            }
            else {
                gs.roundEndCountdown = 240;
            }
        }
        else if (team2Win && !team1Win) {
            gs.roundWinner = 2;
            gs.team2Score += 1;
            if (gs.team2Score >= 3) {
                gs.gameFinished = true;
                gs.gameWinner = 2;
            }
            else {
                gs.roundEndCountdown = 240;
            }
        }
        else {
            gs.roundWinner = "It's a tie";
        }
    }
}
let transferItem = (gs, oldHolder, newHolder, item) => {
	if (!!oldHolder) {
		oldHolder.heldItem = undefined;
		oldHolder.holdingItem = false;
	}
	if (!!newHolder) {
		newHolder.heldItem = item;
		newHolder.holdingItem = true;
		if (newHolder.type === "player") {
			item.heldByPlayer = true;
			item.heldByAppliance = false;
			item.heldByPlant = false;
		}
		else if (newHolder.type === "appliance") {
			item.heldByPlayer = false;
			item.heldByAppliance = true;
			item.heldByPlant = false;
		}
		else if (newHolder.type === "plant") {
			item.heldByPlayer = false;
			item.heldByAppliance = false;
			item.heldByPlant = true;
		}
		item.holder = newHolder;
	}
	else {
		// Remove item if no new holder
		item.toBeRemoved = true;
		item.heldByPlayer = false;
		item.heldByAppliance = false;
		item.heldByPlant = false;
		item.holder = undefined;
	}
}
let deterministicRandom = (gs) => {
	return (((gs.frameCount + 4301) * 2731) % 2903) / 2903;
}
let wrapRotationToPiBounds = (rotation) => {
	if (rotation > Math.PI) {
		rotation -= Math.PI * 2;
	}
	if (rotation < -Math.PI) {
		rotation += Math.PI * 2;
	}
	return rotation
}

let inputChanged = false;
let keyDownFunction = (event) => {
	if (event.keyCode === 87 && !wDown) {
		wDown = true;
	}
	else if (event.keyCode === 65 && !aDown) {
		aDown = true;
	}
	else if (event.keyCode === 83 && !sDown) {
		sDown = true;
	}
	else if (event.keyCode === 68 && !dDown) {
		dDown = true;
	}
	else if (event.keyCode === 69 && !eDown) {
		eDown = true;
	}
	else if (event.keyCode === 82 && !rDown) {
		rDown = true;
	}
	else if (event.keyCode === 70 && !fDown) {
		fDown = true;
	}
	else if (event.keyCode === 16 && !shiftDown) {
		shiftDown = true;
	}
	else {
		return;
	}
	inputChanged = true;
}
let keyUpFunction = (event) => {
	if (event.keyCode === 87) {
		wDown = false;
	}
	else if (event.keyCode === 65) {
		aDown = false;
	}
	else if (event.keyCode === 83) {
		sDown = false;
	}
	else if (event.keyCode === 68) {
		dDown = false;
	}
	else if (event.keyCode === 69) {
		eDown = false;
	}
	else if (event.keyCode === 82) {
		rDown = false;
	}
	else if (event.keyCode === 70) {
		fDown = false;
	}
	else if (event.keyCode === 16) {
		shiftDown = false;
	}
	else {
		return;
	}
	inputChanged = true;
}
let mouseDownFunction = (event) => {
	if (event.button === 0) {
		if (!leftMouseDown) {
			inputChanged = true;
		}
		leftMouseDown = true;
	}
	else if (event.button === 2) {
		if (!rightMouseDown) {
			inputChanged = true;
		}
		rightMouseDown = true;
	}
}
let mouseUpFunction = (event) => {
	if (event.button === 0) {
		if (leftMouseDown) {
			inputChanged = true;
		}
		leftMouseDown = false;
	}
	else if (event.button === 2) {
		if (rightMouseDown) {
			inputChanged = true;
		}
		rightMouseDown = false;
	}
	/*if (mouseDown) {
		inputChanged = true;
	}
	mouseDown = false;*/
}
let mouseMoveFunction = (event) => {
	if (event.clientX !== xMouseScreen || event.clientY !== yMouseScreen) {
		inputChanged = true;
	}
	xMouseScreen = event.x || event.clientX;
	yMouseScreen = event.y || event.clientY;
}

let contextMenuFunction = (event) => {
	if (gameStarted) {
		event.preventDefault();
		return false;
	}
}

let resizeFunction = (event) => {
	renderer.setSize(window.innerWidth, window.innerHeight);
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
}
let meshToScreenCoordinates = (mesh) => {
	let vector = new THREE.Vector3();
	mesh.updateMatrixWorld();
	vector.setFromMatrixPosition(mesh.matrixWorld);
	vector.project(camera);
	//not using window.devicePixelRatio for now
	return new THREE.Vector2(Math.round((0.5 + vector.x / 2) * window.innerWidth), Math.round((0.5 - vector.y / 2) * window.innerHeight));
}
let socket = undefined;
let connected = false;
let setupNetworkConnection = () => {
	try {
		let wsProtocol;
		let socketURL;
		if (location.href.indexOf("kramff.com") !== -1) {
			wsProtocol = "wss://";
			socketURL = wsProtocol + "bine.nfshost.com/shadow/";
		}
		else {
			wsProtocol = "ws://";
			socketURL = (location.protocol + "//" + location.host + "/").replace(/\d+\/$/, "8066").replace("http://", wsProtocol);
		}
		socket = new WebSocket(socketURL);
		socket.onopen = (data) => {
			console.log("connected to server!");
			connected = true;
			makeRoomButton.disabled = undefined;
		}
		socket.onmessage = (message) => {
			let messageParse = JSON.parse(message.data);
			let messageType = messageParse.type;
			let messageData = messageParse.data;
			// new available room/rooms
			if (messageType === "localPlayerID") {
				localPlayerID = messageData;
				// Remove local player from playerFrameAdvantages list if still in there
				// playerFrameAdvantages = playerFrameAdvantages.filter(entry => entry.id !== localPlayerID);
			}
			else if (messageType === "roomInfo") {
				if (Array.isArray(messageData)) {
					messageData.forEach(roomData => {makeRoomOption(roomData.roomName, roomData.roomID, roomData.gameStarted)})
				}
				else {
					makeRoomOption(messageData.roomName, messageData.roomID, messageData.gameStarted);
				}
			}
			// room removed
			else if (messageType === "roomRemoved") {
				removeRoomOption(messageData);
			}
			// room information (other players joining / leaving the waiting room or switching teams)
			else if (messageType === "roomStatusPlayerJoin") {
				makePlayerEntry(messageData.playerName, messageData.playerID, messageData.playerTeam || 1);
			}
			else if (messageType === "roomStatusPlayerLeave") {
				removePlayerEntry(messageData);
			}
			else if (messageType === "roomStatusSwitchTeam") {
				switchPlayerTeam(messageData.playerID, messageData.team);
			}
			// game starting
			else if (messageType === "gameStarting") {
				goToView("game");
				backgroundOverGame.classList.remove("active_bg");
				gameStartPlayerInfo = messageData;
				gameStarted = true;
				currentGameState = createGameState();
                window["cgsref"] = currentGameState;
				let initInfo = initializeGameState(currentGameState);
				playerFrameAdvantages = [];
				gameStartPlayerInfo.forEach(playerData => {
					let newPlayerObject = createPlayer(currentGameState, playerData.playerName, playerData.playerID, playerData.playerTeam);
					if (newPlayerObject.team === 1) {
						newPlayerObject.xPosition = initInfo.t1x;
						newPlayerObject.xStartPosition = initInfo.t1x;
						newPlayerObject.yPosition = initInfo.t1y;
						newPlayerObject.yStartPosition = initInfo.t1y;
					}
					else if (newPlayerObject.team === 2) {
						newPlayerObject.xPosition = initInfo.t2x;
						newPlayerObject.xStartPosition = initInfo.t2x;
						newPlayerObject.yPosition = initInfo.t2y;
						newPlayerObject.yStartPosition = initInfo.t2y;
					}
					// Don't add local player to playerFrameAdvantages
					if (playerData.playerID !== localPlayerID) {
						playerFrameAdvantages.push({id: playerData.playerID, frameAdvantage: 0});
					}
				});
				// copy the initial game state to reset to it later
				initialGameStateCopy = copyGameState(currentGameState);
				console.log("starting game loop");
				lastTime = Date.now();
				gameLoop();
			}
			// other player input
			else if (messageType === "playerInput") {
				playerInputLog.push(messageData);
				// If the input was meant for an earlier frame (or this frame) than what we're currently on, prepare to do a rollback simulation
				if (messageData.frameCount <= currentFrameCount) {
					rollbackInputReceived = true;
				}
				// Calculate remoteFrameLag
				let remoteFrameLag = (messageData.frameCount - inputDelay) - currentFrameCount;
				let playerEntry = playerFrameAdvantages.find(entry => entry.id === messageData.id);
				playerEntry.frameAdvantage = remoteFrameLag;
			}
			// other player quitting
			else if (messageType === "playerQuit") {
			}
			// other player pausing the game
			else if (messageType === "pauseGame") {
				gamePaused = true;
				pauseGameButton.textContent = "Resume Game";
			}
			// other player resuming the game
			else if (messageType === "resumeGame") {
				gamePaused = false;
				pauseGameButton.textContent = "Pause Game";
			}
			// other player used the desync eval tool
			else if (messageType === "desyncTool") {
				// send whole game state history
				console.log("Other player requested full game state history for desync detector tool");
				sendData("gameStateHistory", gameStateHistory.map(copyGameStateNoCircularRef));
				console.log("Sent game state history...");
			}
			// other player sending game state history
			else if (messageType === "gameStateHistory") {
				console.log("Got game state history, running desync detector...");
				//  read through history and compare each frame state
				let foundDesync = false;
				messageData.forEach((otherGameState, index) => {
					if (foundDesync) {
						// Already found a desync - no need to keep iterating
						return;
					}
					if (gameStateHistory.length <= index) {
						console.log("remote gameStateHistory ran out of states without finding a desync");
						console.log(`local: ${gameStateHistory.length} frames, remote: ${messageData.length} frames`);
						foundDesync = true;
						return;
					}
					let statesDifferent = compareGameStates(gameStateHistory[index], otherGameState);
					if (statesDifferent) {
						console.log(`Desync detected at frame ${index}`);
						console.log(gameStateHistory[index]);
						console.log(otherGameState);
						console.log("Full game state histories:");
						console.log(gameStateHistory)
						console.log(messageData);
						foundDesync = true;
					}
				});
				if (!foundDesync) {
					console.log("No desync detected!");
				}
			}
		}
	}
	catch (error) {
		console.error("Could not connect to server");
		console.error(error);
	}
}
let sendData = (type, data) => {
	if (!connected) {
		return;
	}
	let sendObjStr = JSON.stringify({type: type, data: data});
	socket.send(sendObjStr);
}


