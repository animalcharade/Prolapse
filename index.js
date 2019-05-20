//Function for printing to console with newline
function print(message){
  process.stdout.write(message + "\n");
}
//Function for printing to console without newline
function printSegment(message){
  process.stdout.write(message + " ");
}

print("Starting!");

//Arguments
printSegment("Parsing arguments...");

const argv = require("yargs")
  .alias("t", "test")
  .describe("t", "Test Mode")
  .boolean("t")
  .argv;

if(argv.test){
  print("Test mode enabled!");
} else {
  print("No arguments.");
}

//Requirements
printSegment("Executing requirements...");

require("dotenv").config();
const sunCalc = require("suncalc");
const wifi = require("pi-wifi");
const util = require("util");

const path = require("path");
const fs = require("fs");
const readDir = util.promisify(fs.readdir);
const unlink = util.promisify(fs.unlink);

const goProModule = require("goproh4");
const goPro = new goProModule.Camera({
  mac: process.env.GOPRO_MAC
});

const dropboxV2Api = require("dropbox-v2-api");
const dropbox = util.promisify(dropboxV2Api.authenticate({
  token: process.env.DROPBOX_TOKEN
}));


print("Done!");

//Settings

printSegment("Setting GoPro latitude/longitude...");

const latitude = 46.8721;
const longitude = -113.9940;

print("Done!");

printSegment("Setting timelapse length...");

const MINUTE = 1000 * 60;
const HOUR = MINUTE * 60;

let timelapseLength = process.env.HOURS * HOUR + process.env.MINUTES * MINUTE;

print("Done!");
print("Timelapses will last for " + timelapseLength / 1000 / 60 + " minutes.");

//Promisify things

printSegment("Promisifying wifi utilities...");

const connect = util.promisify(wifi.connectToId);
const disconnect = util.promisify(wifi.disconnect);
const listNetworks = util.promisify(wifi.listNetworks);

//Set up wireless networks

let networks;
let homeNetwork;
let goProNetwork;

async function setUpNetworks(){

  printSegment("Getting list of Raspberry Pi's networks...");

  networks = await listNetworks();

  print("Done!");

  print(JSON.stringify(networks));

  printSegment("Finding home and GoPro network IDs...");

  homeNetwork = networks.find(network => network.ssid === process.env.HOME_SSID).network_id;
  goProNetwork = networks.find(network => network.ssid === process.env.GOPRO_SSID).network_id;

  print("Done!");

  print("The Home Network ID is: " + homeNetwork);
  print("The GoPro Network ID is: " + goProNetwork);

}

//Set up our delay function, allowing us to wait between commands

function delay(duration){
  return new Promise(function (resolve){
    setTimeout(resolve, duration);
  });
}

//Timelapse function

async function doTimelapse(date, timelapseStart, timelapseEnd, folderName){
  while(Date.now() < timelapseStart){
    let timeRemaining = (timelapseStart - Date.now()) / 1000; //In seconds
    printSegment("\r Waiting " + timeRemaining  + " seconds for timelapse to start...   ");
  await delay(1000);
  }

  print("Ready!");

  //Disconnect from home WiFi
  
  printSegment("Disconnecting from WiFi...");
  
  await disconnect();

  await delay(1000); //Network card needs a sec to complete disconnect

  print("Done!");

  //Connect to GoPro WiFi
  
  try{
  
    printSegment("Connecting to GoPro...");
    
    await connect(goProNetwork);
    await delay(20000);

    print("Done!");
    
    //Turn on GoPro
    
    printSegment("Powering on GoPro...");
    
    goPro.powerOn();
    print(JSON.stringify(await goPro.status()));
    await delay(1000);
    
    print("Done!");

    //Set GoPro to timelapse mode
    
    printSegment("Setting GoPro mode to Timelapse...");

    await goPro.mode(goProModule.Settings.Modes.Burst,goProModule.Settings.Submodes.Burst.NightLapse);
    await delay(1000);

    print("Done!");

    //Set timelapse interval
    
    printSegment("Setting timelapse interval...");
    
    print(JSON.stringify(goProModule.Settings.BurstNightlapseInterval)); 
    await goPro.set(goProModule.Settings.BURST_NIGHTLAPSE_INTERVAL,10);
    await delay(1000);

    print("Done!");

    //Set timelapse exposure time
    
    printSegment("Setting timelapse exposure time...");

    await goPro.set(goProModule.Settings.BURST_EXPOSURE_TIME,goProModule.Settings.BurstExposureTime.Auto);
    await delay(1000);

    print("Done!");

    //Begin timelapse
    
    printSegment("Initiating timelapse...");

    await goPro.start();
    await delay(1000);

    print("Done!");

    //Disconnect from GoPro WiFi

    printSegment("Disconnecting from GoPro...");

    await disconnect();
    await delay(1000);

    print("Done!");

    //Wait until it's time to end timelapse
    
    while(Date.now() < timelapseEnd){
      let timeRemaining = (timelapseEnd - Date.now()) / 1000; //In seconds
      printSegment("\r Waiting " + timeRemaining  + " seconds for timelapse to complete...   ");
      await delay(1000);
    }

    print("Done!");

    //Connect to GoPro WiFi
    
    printSegment("Connecting to GoPro...");
    
    await connect(goProNetwork);
    await delay(20000);

    print("Done!");

    //Stop timelapse
    
    printSegment("Stopping timelapse...");

    await goPro.stop();
    await delay(1000);

    print("Done!");

    //Download files
    
    const media  = (await goPro.listMedia()).media;
    
    
    print(JSON.stringify(media)); 
    for(let i = 0; i < media.length; i++){
      const directory = media[i].d;
      const files = media[i].fs;
      for(let j = 0; j < files.length; j++){
        const header = files[j].g;
        const firstImage = files[j].b;
        const lastImage = files[j].l;
        for(let k = firstImage; k <= lastImage; k++){
          const filename = "G00" + header + k + ".JPG";
          const path = "./buffer/"+filename;
          printSegment("Saving " + path + "...");
          await goPro.getMedia(directory,filename,path);
          print("Done!");
        }
        
      }
    }

    //Delete files

    printSegment("Clearing camera's storage...");

    await goPro.deleteAll();

    print("Done!");

/*    //Turn off GoPro
    
    printSegment("Turning off GoPro...");

    await goPro.powerOff();
    await delay(1000);


    print("Done!");
*/
  } catch(err) {
    print("Something's wrong; will attempt to reconnect to home network!");
    throw err;
  } finally {

    //Disconnect from GoPro Wifi
    
    printSegment("Disconnecting from GoPro...");

    await disconnect();
    await delay(1000);

    print("Done!");
    
    //Connect to home WiFi
      
    printSegment("Connecting to home network...");

    await connect(homeNetwork);
    await delay(15000);

    print("Done!");

  }

  //Get list of local files

  printSegment("Getting list of files to be uploaded to Dropbox...");
  
  const localFiles = await readDir("./buffer/");

  print("Done!");
  print(localFiles.length + " files!");
  
  
  //Set Dropbox upload destination
  
  printSegment("Setting Dropbox destination...");

  const dboxRoot = process.env.DROPBOX_ROOT
  const dboxYear = date.getFullYear()
  const monthArray = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const dboxMonth = ("0" + (date.getMonth() + 1)).slice(-2)  + " " + monthArray[date.getMonth()];
  const dboxDay = date.getDate();

  const dropboxPath = path.normalize([dboxRoot, dboxYear, dboxMonth, dboxDay, folderName].join("/"));

  print("Done!");
  print(dropboxPath);

  //Upload files to DropBox
  
  for(let i = 0; i < localFiles.length; i++){
    printSegment("Uploading " + localFiles[i] + "...");
    await dropbox({
      resource: "files/upload",
      parameters: {
        path: dropboxPath + "/" + localFiles[i] 
      },
      readStream: fs.createReadStream("./buffer/" + localFiles[i])
    });

    print("Done!");
    printSegment("Removing local version...");
    await unlink("./buffer/" + localFiles[i]);
    print("Done! " + (localFiles.length - i - 1) + " remaining!");
  }
}

//Main function

async function main(){

  await setUpNetworks();

  //Get the current date/time

  printSegment("Getting the current date and time...");

  const date = new Date();

  print("Done!");
  print("The current date/time is " + date);

  //Are we in test mode?

  if(argv.test){

    //If we're in test mode, start a one-minute timelapse one minute from now.

    doTimelapse(date, Date.now() + MINUTE, Date.now() + MINUTE * 2, "Test");

  } else {

    //Get today's sunrise and sunset time
    
    printSegment("Getting today's sunrise & sunset times...");
    
    const times = sunCalc.getTimes(date, latitude, longitude);
    const sunrise = times.sunrise;
    const sunset = times.sunset;

    print("Done!");
    print("Today's sunrise will be at " + sunrise);
    print("Tonight's sunset will be at " + sunset);

    //Set GoPro start/end times

    printSegment("Setting timelapse start and end times...");
    
    const sunriselapseStart = +sunrise - timelapseLength / 2;
    const sunriselapseEnd = +sunrise + timelapseLength / 2;

    const sunsetlapseStart = +sunset - timelapseLength / 2;
    const sunsetlapseEnd = +sunset + timelapseLength / 2;

    print("Done!");
    print("The sunrise timelapse will begin at " + new Date(sunriselapseStart));
    print("The sunrise timelapse will end at " + new Date(sunriselapseEnd));
    print("The sunset timelapse will begin at " + new Date(sunsetlapseStart));
    print("The sunset timelapse will end at " + new Date(sunsetlapseEnd));

    if(Date.now() < sunriselapseStart){
      await doTimelapse(date, sunriselapseStart, sunriselapseEnd, process.env.SUNRISE_FOLDER_NAME);
    } else {
      print("Too late to start sunrise timelapse; skipping!");
    }

    if(Date.now() < sunsetlapseStart){
      await doTimelapse(date, sunsetlapseStart, sunsetlapseEnd, process.env.SUNSET_FOLDER_NAME);
    } else {
      print("Too late to start sunset timelapse; skipping!");
    }
  }

  print("Job complete! Exiting!");
}
main().catch(function(error){ console.error(error)});
