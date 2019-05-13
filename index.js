//Requirements
const sunCalc = require("suncalc");
const goProModule = require("goproh4");
const wifi = require("pi-wifi");

//Settings
const latitude = 46.8721;
const longitude = -113.9940;
const timelapseLength = 7200000;

//Home network details
const homeNetwork = {
	ssid: "",
	password: ""
};

//GoPro network details
const goProNetwork = {
	ssid: ""
	password: ""
};

//Get the current date/time
const date = new Date();

//Get today's sunset time
const times = sunCalc.getTimes(date, latitude, longitude);
console.log(times);
const sunset = times.sunset;
//Set GoPro start/end times
const goProStart = sunset - timelapseLength / 2;
const goProEnd = sunset + timelapseLength / 2;

//Set time of program start
const timeAtStart = date;

//Set up our delay function, allowing us to wait between commands
function delay(duration){
	return new Promise(function (resolve){
		setTimeout(resolve, duration);
	});
}

//Main function
async function main(){
	//Wait until it's time to start our timelapse
	await delay(goProStart - timeAtStart);

	//Disconnect from home WiFi
	wifi.disconnect();

	//Connect to GoPro WiFi
	
	
	//Turn on GoPro
	//Set GoPro to timelapse mode
	//Begin timelapse
	//Disconnect from GoPro WiFi
	//Wait until it's time to end timelapse
	await delay(timelapseLength);	
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




