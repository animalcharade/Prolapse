// Function for printing to console with newline
function print(message) {
  process.stdout.write(message + '\n');
}
// Function for printing to console without newline
function printSegment(message) {
  process.stdout.write(message + ' ');
}

print('Starting!');

// Arguments
printSegment('Parsing arguments...');

const { argv } = require('yargs')
  .options({
    c: {
      alias: 'custom',
      boolean: 'c',
      describe: 'Custom Mode',
    },
    t: {
      alias: 'test',
      boolean: true,
      describe: 'Test Mode',
    },
  });

if (argv.test) {
  print('Test mode enabled!');
} else {
  print('No arguments.');
}

// Requirements
printSegment('Executing requirements...');

require('dotenv').config();
const dropboxV2Api = require('dropbox-v2-api');
const fs = require('fs');
const goProModule = require('goproh4');
const path = require('path');
const wifi = require('pi-wifi');
const sunCalc = require('suncalc');
const util = require('util');

print('Done!');

// Set up GoPro connection

const goPro = new goProModule.Camera({
  mac: process.env.GOPRO_MAC,
});

// Set up Dropbox authentication

const dropbox = util.promisify(dropboxV2Api.authenticate({
  token: process.env.DROPBOX_TOKEN,
}));

// Settings

printSegment('Setting GoPro latitude/longitude...');

const latitude = process.env.LATITUDE;
const longitude = process.env.LONGITUDE;

print('Done!');

printSegment('Setting timelapse length...');

const MINUTE = 1000 * 60;
const HOUR = MINUTE * 60;

const timelapseLength = process.env.HOURS * HOUR + process.env.MINUTES * MINUTE;

print('Done!');
print('Timelapses will last for ' + timelapseLength / 1000 / 60 + ' minutes.');

// Promisify functions that use callbacks

printSegment('Promisifying callback functions...');

const readDir = util.promisify(fs.readdir);
const unlink = util.promisify(fs.unlink);

const connect = util.promisify(wifi.connectToId);
const disconnect = util.promisify(wifi.disconnect);
const listNetworks = util.promisify(wifi.listNetworks);
const scanWifi = util.promisify(wifi.scan);

print('Done!');

// Set up wireless networks

let networks;
let homeNetwork;
let goProNetwork;

async function getNetworkIDs() {
  // Get list of Raspberry Pi's networks

  printSegment('Getting list of Raspberry Pi\'s saved networks...');

  networks = await listNetworks();

  print('Done!');
  print(JSON.stringify(networks));

  // Find network IDs for home and GoPro networks

  printSegment('Finding home and GoPro network IDs...');

  homeNetwork = networks.find(network => network.ssid === process.env.HOME_SSID).network_id;
  goProNetwork = networks.find(network => network.ssid === process.env.GOPRO_SSID).network_id;

  print('Done!');
  print('The Home Network ID is: ' + homeNetwork);
  print('The GoPro Network ID is: ' + goProNetwork);
}

// Set up our delay function, allowing us to wait between commands

function delay(duration) {
  return new Promise(((resolve) => {
    setTimeout(resolve, duration);
  }));
}

// Network verification function, to check for the presense of a network before attempting to connect to it

async function verifyNetwork(ssid) {
  printSegment('Verifying presense of network "' + ssid + '"...');

  const availableNetworks = await scanWifi();

  if (!availableNetworks.some(network => network.ssid === process.env.GOPRO_SSID)) {
    print('Error!');
    throw new Error('"' + ssid + '" is unavailable; aborting.');
  }

  print('Done!');
}

// Promise map function to limit parallel promises

async function promiseMap(array, fn, parallelLimit = array.length, progress = () => {}) {
  const allPromises = [];
  let currentPromises = [];
  for (let i = 0; i < array.length; i++) {
    const promise = Promise.resolve(fn(array[i], i, array));
    allPromises.push(promise);
    currentPromises.push(promise);
    // eslint-disable-next-line no-loop-func
    promise.then(() => {
      currentPromises = currentPromises.filter(elem => elem !== promise);
      progress(allPromises.length - currentPromises.length, array.length);
    });

    if (currentPromises.length >= parallelLimit) {
      await Promise.race(currentPromises);
    }
  }

  return Promise.all(allPromises);
}

// Upload a single file to Dropbox function

async function uploadFileToDropbox(file, destinationPath) {
  print('Uploading ' + file + '...');

  const dropboxRequest = (resource, parameters) => dropbox({ resource, ...parameters });
  await dropboxRequest('files/upload', {
    parameters: {
      path: destinationPath + '/' + file,
    },
    readStream: fs.createReadStream('./buffer/' + file),
  });

  printSegment(file + 'uploaded successfully! Removing local version...');
  await unlink('./buffer/' + file);
  print(file + ' cleared from local storage!');
}

// Upload an array of files to Dropbox function

async function uploadFilesToDropbox(fileArray, destinationPath) {
  print(fileArray.length + ' files to upload!');
  promiseMap(fileArray,
    file => uploadFileToDropbox(file, destinationPath),
    10,
    (finished, total) => {
      print(total - finished + ' files remaining!');
    });
}

// Timelapse function

async function doTimelapse(date, timelapseStart, timelapseEnd, folderName) {
  while (Date.now() < timelapseStart) {
    const timeRemaining = (timelapseStart - Date.now()) / 1000; // In seconds
    printSegment('\r Waiting ' + timeRemaining + ' seconds for timelapse to start...   ');
    await delay(1000);
  }

  print('Ready!');

  // Verify GoPro network exists

  verifyNetwork(process.env.GOPRO_SSID);

  // Disconnect from home WiFi

  printSegment('Disconnecting from WiFi...');

  await disconnect();

  await delay(1000); // Network card needs a sec to complete disconnect

  print('Done!');

  // Connect to GoPro WiFi

  try {
    printSegment('Connecting to GoPro...');

    await connect(goProNetwork);
    await delay(20000);

    print('Done!');

    // Turn on GoPro

    printSegment('Powering on GoPro...');

    goPro.powerOn();
    print(JSON.stringify(await goPro.status()));
    await delay(1000);

    print('Done!');

    // Set GoPro to timelapse mode

    printSegment('Setting GoPro mode to Timelapse...');

    await goPro.mode(goProModule.Settings.Modes.Burst,
      goProModule.Settings.Submodes.Burst.NightLapse);
    await delay(1000);

    print('Done!');

    // Set timelapse interval

    printSegment('Setting timelapse interval...');

    print(JSON.stringify(goProModule.Settings.BurstNightlapseInterval));
    await goPro.set(goProModule.Settings.BURST_NIGHTLAPSE_INTERVAL, 10);
    await delay(1000);

    print('Done!');

    // Set timelapse exposure time

    printSegment('Setting timelapse exposure time...');

    await goPro.set(goProModule.Settings.BURST_EXPOSURE_TIME,
      goProModule.Settings.BurstExposureTime.Auto);
    await delay(1000);

    print('Done!');

    // Begin timelapse

    printSegment('Initiating timelapse...');

    await goPro.start();
    await delay(1000);

    print('Done!');

    // Disconnect from GoPro WiFi

    printSegment('Disconnecting from GoPro...');

    await disconnect();
    await delay(1000);

    print('Done!');

    // Wait until it's time to end timelapse

    while (Date.now() < timelapseEnd) {
      const timeRemaining = (timelapseEnd - Date.now()) / 1000; // In seconds
      printSegment('\r Waiting ' + timeRemaining + ' seconds for timelapse to complete...   ');
      await delay(1000);
    }

    print('Done!');

    // Connect to GoPro WiFi

    printSegment('Connecting to GoPro...');

    await connect(goProNetwork);
    await delay(20000);

    print('Done!');

    // Stop timelapse

    printSegment('Stopping timelapse...');

    await goPro.stop();
    await delay(1000);

    print('Done!');

    // Download files

    const { media } = (await goPro.listMedia());

    print(JSON.stringify(media));
    for (let i = 0; i < media.length; i++) {
      const directory = media[i].d;
      const files = media[i].fs;
      for (let j = 0; j < files.length; j++) {
        const header = files[j].g;
        const firstImage = files[j].b;
        const lastImage = files[j].l;
        for (let k = firstImage; k <= lastImage; k++) {
          const filename = 'G00' + header + k + '.JPG';
          const filepath = './buffer/' + filename;
          printSegment('Saving ' + filepath + '...');
          await goPro.getMedia(directory, filename, filepath);
          print('Done!');
        }
      }
    }

    // Delete files

    printSegment('Clearing camera\'s storage...');

    await goPro.deleteAll();

    print('Done!');

    /*
    // Turn off GoPro

    printSegment('Turning off GoPro...');

    await goPro.powerOff();
    await delay(1000);


    print('Done!');
    */
  } catch (err) {
    print('Something\'s wrong; will attempt to reconnect to home network!');
    throw err;
  } finally {
    // Disconnect from GoPro Wifi

    printSegment('Disconnecting from GoPro...');

    await disconnect();
    await delay(1000);

    print('Done!');

    // Connect to home WiFi

    printSegment('Connecting to home network...');

    await connect(homeNetwork);
    await delay(15000);

    print('Done!');
  }

  // Get list of local files

  printSegment('Getting list of files to be uploaded to Dropbox...');

  const localFiles = await readDir('./buffer/');

  print('Done!');
  print(localFiles.length + ' files!');


  // Set Dropbox upload destination

  printSegment('Setting Dropbox destination...');

  const dboxRoot = process.env.DROPBOX_ROOT;
  const dboxYear = date.getFullYear();
  const monthArray = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dboxMonth = ('0' + (date.getMonth() + 1)).slice(-2) + ' ' + monthArray[date.getMonth()];
  const dboxDay = date.getDate();

  const dropboxPath = path.normalize([dboxRoot, dboxYear, dboxMonth, dboxDay, folderName].join('/'));

  print('Done!');
  print(dropboxPath);

  // Upload files to DropBox

  uploadFilesToDropbox(localFiles, dropboxPath);
}

// Main function

async function main() {
  // Verify that the GoPro's network is available

  await verifyNetwork(process.env.GOPRO_SSID);

  // Get the IDs for the networks we'll be connecting to

  await getNetworkIDs();

  // Get the current date/time

  printSegment('Getting the current date and time...');

  const thisDate = new Date();

  print('Done!');
  print('The current date/time is ' + thisDate);

  // Did we launch with any arguments?

  if (argv.test) {
    // If we're in test mode, start a one-minute timelapse five seconds from now.

    await doTimelapse(thisDate, Date.now() + 5000, Date.now() + MINUTE + 5000, 'Test');
  } else if (argv.custom) {
    // If we're in custom mode, start a timelapse with custom parameters
    await doTimelapse(
      thisDate,
      Date.now(),
      Date.now() + MINUTE * argv.timelapseLength,
      argv.folderName,
    );
  } else {
    // Get today's sunrise and sunset time

    printSegment('Getting today\'s sunrise & sunset times...');

    const times = sunCalc.getTimes(thisDate, latitude, longitude);
    const { sunrise } = times;
    const { sunset } = times;

    print('Done!');
    print('Today\'s sunrise will be at ' + sunrise);
    print('Tonight\'s sunset will be at ' + sunset);

    // Set GoPro start/end times

    printSegment('Setting timelapse start and end times...');

    const sunriselapseStart = +sunrise - timelapseLength / 2;
    const sunriselapseEnd = +sunrise + timelapseLength / 2;

    const sunsetlapseStart = +sunset - timelapseLength / 2;
    const sunsetlapseEnd = +sunset + timelapseLength / 2;

    print('Done!');
    print('The sunrise timelapse will begin at ' + new Date(sunriselapseStart));
    print('The sunrise timelapse will end at ' + new Date(sunriselapseEnd));
    print('The sunset timelapse will begin at ' + new Date(sunsetlapseStart));
    print('The sunset timelapse will end at ' + new Date(sunsetlapseEnd));

    // Are we in time to start the sunrise timelapse?

    if (Date.now() < sunriselapseStart) {
      await doTimelapse(
        thisDate,
        sunriselapseStart,
        sunriselapseEnd,
        process.env.SUNRISE_FOLDER_NAME,
      );
    } else {
      print('Too late to start sunrise timelapse; skipping!');
    }

    // Are we in time to start the sunset timelapse?

    if (Date.now() < sunsetlapseStart) {
      await doTimelapse(thisDate, sunsetlapseStart, sunsetlapseEnd, process.env.SUNSET_FOLDER_NAME);
    } else {
      print('Too late to start sunset timelapse; skipping!');
    }
  }

  print('Job complete! Exiting!');
}

main().catch((error) => {
  console.error(error);
});
