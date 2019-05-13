//Requirements
require('dotenv').config();
const sunCalc = require("suncalc");
const goProModule = require("goproh4");
const wifi = require("pi-wifi");
const util = require("util");

//Settings
const latitude = 46.8721;
const longitude = -113.9940;
const timelapseLength = 7200000;

//Promisify things
const connect = util.promisify(wifi.connectToId);
const disconnect = util.promisify(wifi.disconnect);
const listNetworks = util.promisify(wifi.listNetworks);


//Set up our delay function, allowing us to wait between commands
function delay(duration){
	return new Promise(function (resolve){
		setTimeout(resolve, duration);
	});
}

//Main function
async function main(){
	
	//Set network details
	const networks = await listNetworks();
	console.log(networks);
	const homeNetwork = networks.find(network => network.ssid === process.env.HOME_SSID).network_id;
	const goProNetwork = networks.find(network => network.ssid === process.env.GOPRO_SSID).network_id;

	console.log(`The Home Network ID is ${homeNetwork}`);
	console.log(`The GoPro Network ID is ${goProNetwork}`);

	//Get the current date/time
	const date = new Date();

	console.log(`The current date/time is ${date}`);

	//Get today's sunset time
	//const times = sunCalc.getTimes(date, latitude, longitude);
	//console.log(`Tonight's sunset will be at ${times.sunset}`);
	//const sunset = times.sunset;

	//Set GoPro start/end times
	//const goProStart = sunset - timelapseLength / 2;
	//const goProEnd = sunset + timelapseLength / 2;

	//Set time of program start
	const timeAtStart = date;

	//Wait until it's time to start our timelapse
	//await delay(goProStart - timeAtStart);

	//Disconnect from home WiFi
	console.log(`Disconnecting from WiFi...`);
	await disconnect();
	console.log(`Disconnected from WiFi`);

	await delay(10000);

	//Connect to GoPro WiFi
	console.log(`Connecting to WiFi...`);
	await connect(homeNetwork);	
	console.log(`Connected to WiFi`);
	//Turn on GoPro
	

	//Set GoPro to timelapse mode
	//Begin timelapse
	//Disconnect from GoPro WiFi
	//Wait until it's time to end timelapse
	//await delay(timelapseLength);	
	//Connect to GoPro WiFi
	//Stop timelapse
	//Download files
	//Delete files
	//Turn off GoPro
	//Disconnect from GoPro Wifi
	//Connect to home WiFi
	//Create a new folder in Dropbox for this date
	//Upload files to DropBox
	
}
main();




