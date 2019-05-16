//Function for printing to console with newline
function print(message){
	process.stdout.write(message + "\n");
}
//Function for printing to console without newline
function printLine(message){
	process.stdout.write(message + " ");
}

print("Starting!");

//Requirements
printLine("Executing requirements...");

require('dotenv').config();
const sunCalc = require("suncalc");
const wifi = require("pi-wifi");
const util = require("util");
const goProModule = require("goproh4");
const goPro = new goProModule.Camera({
	mac: process.env.GOPRO_MAC
});

print("Done!");

//Settings

printLine("Setting GoPro latitude/longitude...");

const latitude = 46.8721;
const longitude = -113.9940;

print("Done!");

printLine("Setting timelapse length...");

const timelapseLength = 7200000;

print("Done!");

//Promisify things

printLine("Promisifying wifi utilities...");

const connect = util.promisify(wifi.connectToId);
const disconnect = util.promisify(wifi.disconnect);
const listNetworks = util.promisify(wifi.listNetworks);
const setInterface = util.promisify(wifi.setCurrentInterface);
const connectionStatus = util.promisify(wifi.status);

print("Done!");

//Set up our delay function, allowing us to wait between commands
function delay(duration){
	return new Promise(function (resolve){
		setTimeout(resolve, duration);
	});
}


//Main function
async function main(){
	
	//Set network details

	printLine("Getting list of Raspberry Pi's networks...");

	const networks = await listNetworks();
	
	print("Done!");

	console.log(networks);

	printLine("Finding home and GoPro network IDs...");

	const homeNetwork = networks.find(network => network.ssid === process.env.HOME_SSID).network_id;
	const goProNetwork = networks.find(network => network.ssid === process.env.GOPRO_SSID).network_id;

	print("Done!");

	console.log(`The Home Network ID is: ${homeNetwork}`);
	console.log(`The GoPro Network ID is: ${goProNetwork}`);

	//Get the current date/time
	
	printLine("Getting the current date and time...");

	const date = new Date();

	print("Done!");

	print("The current date/time is " + date);

	//Get today's sunset time
	
	printLine("Getting today's sunset time...");
	
	const times = sunCalc.getTimes(date, latitude, longitude);
	const sunset = times.sunset;

	print("Done!");
	print("Tonight's sunset will be at " + sunset);

	//Set GoPro start/end times

	printLine("Setting timelapse start and end times...");
	
	const timelapseStart = sunset - timelapseLength / 2;
	const timelapseEnd = sunset + timelapseLength / 2;

	print("Done!");
	print("The timelapse will begin at " + timelapseStart);
	print("The timelapse will end at " + timelapseEnd);

	//Wait until it's time to start our timelapse
	
	while(date.now() < timelapseStart){
		let timeRemaining = (timelapseStart - date.now()) / 1000; //In seconds
		printLine("\r Waiting " + timeRemaining  + " seconds for timelapse to start...   ");
	}

	print("Ready!");

	//Disconnect from home WiFi
	
	printLine("Disconnecting from WiFi...");
	
	await disconnect();

	await delay(1000); //Network card needs a sec to complete disconnect

	print("Done!");

	//Connect to GoPro WiFi
	
	printLine("Connecting to GoPro...");
	
	await connect(goProNetwork);
	await delay(15000);

	print("Done!");
	
	//Turn on GoPro
	
	printLine("Powering on GoPro...");
	
	goPro.powerOn();

	for(i = 0; i < 20; i++){
		print(JSON.stringify(await goPro.status()));
		await delay(1000);
	}
	
	print("Done!");

	//Set GoPro to timelapse mode
	
	printLine("Setting GoPro mode to Timelapse...");

	await goPro.mode(goProModule.Settings.Modes.Photo,goProModule.Settings.Submodes.Photo.Continuous);

	print("Done!");

	//Begin timelapse
	
	printLine("Initiating timelapse...");

	await goPro.start();

	print("Done!");

	//Disconnect from GoPro WiFi

	printLine("Disconnecting from GoPro...");

	await disconnect();

	print("Done!");

	//Wait until it's time to end timelapse
	
	while(date.now() < timelapseEnd){
		let timeRemaining = (timelapseEnd - date.now()) / 1000; //In seconds
		printLine("\r Waiting " + timeRemaining  + " seconds for timelapse to complete...   ");
	}

	print("Done!");

	//Connect to GoPro WiFi
	
	printLine("Connecting to GoPro...");
	
	await connect(goProNetwork);
	await delay(15000);

	print("Done!");

	//Stop timelapse
	
	printLine("Stopping timelapse...");

	await goPro.stop();

	print("Done!");

	//Download files
	
	const filesToDownload = await goPro.listMedia();
	
	print(filesToDownload);

//	for(let i = 0; i < filesToDownload.length; i++){
//		goPro.getMedia(filesToDownload[0]
//	}

	//Delete files
	
	//Turn off GoPro
	
	printLine("Turning off GoPro...");

	await goPro.powerOff();

	print("Done!");

	//Disconnect from GoPro Wifi
	
	printLine("Disconnecting from GoPro...");

	await disconnect();
	await delay(1000);

	print("Done!");
	
	//Connect to home WiFi
		
	printLine("Connecting to home network...");

	await connect(homeNetwork);
	await delay(15000);

	print("Done!");
	
	//Create a new folder in Dropbox for this date
	//Upload files to DropBox
	
}
main().catch(function(error){ console.error(error)});
