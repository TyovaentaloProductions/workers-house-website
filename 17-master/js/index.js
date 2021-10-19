// Countries that have some anomalities in their names (such as special chars, brackets, or multiple variants) are collected here
const INITIAL_CODES = {
  Brunei: "BRN",
  "Mainland China": "CHN",
  US: "USA",
  Iran: "IRN",
  "South Korea": "KOR",
  "Korea, South": "KOR",
  Korea: "KOR",
  "Taiwan*": "TWN",
  UK: "GBR",
  "United Kingdom": "GBR",
  Czechia: "CZE",
  Russia: "RUS",
  "United Arab Emirates": "UAE",
  Macau: "MAC",
  "North Macedonia": "MKD",
  Venezuela: "VEN",
  Vietnam: "VNM",
  "Cote d'Ivoire": "CIV",
  "West Bank and Gaza": "PSE",
  Kosovo: "KOS",
  "Congo (Kinshasa)": "COD",
  "Congo (Brazzaville)": "COG",
  Tanzania: "TZA",
  Burma: "MMR",
  Syria: "SYR",
  Laos: "LAO",
  Eswatini: "SWZ"
};
const DEFAULT_FILL = "#EEEEEE";

/**
 * Writes given text to console.log
 * 
 * @param {string} text Text to print out
 * @returns {void} 
 */
const sayHello = (text) => console.log(text);

/**
 * mapNeighbours arrow function returns neighbours of a country
 * as an associative array (i.e., object) where a key is a country codes and
 * the value is an array containing the neighbour country codes.
 * 
 * @param {JSON} rawNeighbours the parsed JSON content fetched from the API endpoint https://tie-lukioplus.rd.tuni.fi/corona/api/neighbours
 * @returns {object} an object where keys are three-char country codes (alpha3codes), and the values are neighbour country codes as an array.
 */
const mapNeighbours = (rawNeighbours) => {

  // Creating the neighbour-map object
  const neighbourMap = new Object();
  for(let i = 0; i < rawNeighbours.length; i++) {

      // Filling map with values from given JSON
      const countryCode = rawNeighbours[i]["alpha3Code"];
      neighbourMap[countryCode] = rawNeighbours[i]["borders"];
  }
  return neighbourMap;
};


/**
 * Creates the per-day-objects for timeseries-functionality
 * 
 * @param {JSON} time delivers JSON from which we modify our own confirmed/deaths- object
 * @param {int} value informs the funktion whether we are dealing with confirmed or death cases
 * @returns {object} - Object array of people confirmed/deaths per day per country
 */
function peopleStatistic(time, value) {

  // Creating new object for list of deaths/infecteds
  const infectedList = new Object();
  let day = 22;
  let month = 1;
  const year = 20;
  const wantedStatistic = Object.keys(time[value])[0];

  // first for-loop cycles through days
  for (let i = 0; i < Object.keys(time[value][wantedStatistic][0]).length; i++) {

    // forms a new date with new date data
    const date = month + "/" + day + "/" + year;
    infectedList[date] = {};

    // Goes on to add countries IF the date is correct according to API data
    if (time[value][wantedStatistic][0][date] !== undefined) {

      // second for-loop cycles through regions and combines them 
      for (let j = 0; j < Object.keys(time[value][wantedStatistic]).length; j++) {
        const infectedCountry = time[value][wantedStatistic][j];

        // adds country statistic to a previous one if it already exists
        if (infectedCountry["Country/Region"] in infectedList[date]) {
          infectedList[date][infectedCountry["Country/Region"]] += infectedCountry[date]; 
        }

        // add a new country statistic, if there isn't one yet
        else {
          infectedList[date][infectedCountry["Country/Region"]] = infectedCountry[date];
        }

      }
    }

    // if the date was over the limit (usually around 30), cycles one month forward
    // and resets the days
    else {
      delete infectedList[date];
      month++;
      day = 0;

    }
    day++;
  }
  return infectedList;
}



/**
 * Helper function to parse an integer from a string
 * 
 * @param {string} str numeric string
 * @returns {number} parsed integer
 */
const int = (str) => Number.parseInt(str);

/**
 * Constructs a HSL color based on the given parameters.
 * The darker the color, the more alarming is the situation-
 * Hue gives the tone: blue indicates confirmed (hue 240), red indicates deaths (hue 360).
 * H: hue ranges between blue and red, i.e., 240..360.
 * S: saturation is constant (100)
 * L: lightness as a percentage between 0..100%, 0 dark .. 100 light
 * 
 * @param {object} confirmed of confirmed people having coronavirus
 * @param {object} deaths number of dead people, 20 times more weight than confirmed
 * @returns {string} a HSL color constructed based on confirmed and deaths
 */
const getColor = (confirmed, deaths) => {
  const denominator = confirmed + deaths === 0 ? 1 : confirmed + deaths;
  const nominator = deaths ? deaths : 0;
  const hue = int(240 + 120 * nominator / denominator);
  const saturation = 100; //constant

  let weight = int(7 * Math.log(confirmed + 20 * deaths));
  weight = weight ? (weight > 100 ? 95 : weight) : 0;

  let lightness = 95 - weight;
  lightness = lightness < 0 ? 0 : lightness;
  return `hsl(${hue}, ${saturation}, ${lightness})`;
};


/**
 * Creates the world datamap visualization element using d3.
 * 
 * @returns {void}
 */
const coronaMap = new Datamap({
  element: document.getElementById("coronamap"),
  projection: "mercator",
  fills: {
    defaultFill: DEFAULT_FILL,
  }
});

/**
 * Updates the date element with the current date or date given as an argument.
 * 
 * @param {*} date - Date given as an argument is written directly to element.
 */
function newDate(date) {
  if (date) {
    document.getElementById("date").innerText = date;
  }
  else {    
    const d = new Date();
    const dateString =   (d.getMonth()+1) + "/" + d.getDate() + "/" + d.getFullYear().toString().substr(2,2);
    document.getElementById("date").innerText = dateString;
  }
}

let interval;
let timeseriesPlaying = false;

/**
 * Button onclick function starts timeseries playback via interval function.
 * If the interval function is already active, it will be removed instead.
 */
function timeseriesPlay() {
  if (timeseriesPlaying) {
    clearInterval(interval);
    timeseriesPlaying = false;
  }
  else {
    snapDate = 0; // Resets the map date.
    coronaMap.updateChoropleth(null, {reset: true}); // Resets map colors.
    mapPlay();
    interval = setInterval(mapPlay, 1000);
    timeseriesPlaying = true;
  }  
}

let snapDate = 0;

/**
 * Cycles through dates and updates map colors as part of the timeseries playback.
 */
function mapPlay() {    
  // Creates an array of dates contained in the infected object.
  // The array will return consecutive date strings using the snapDate variable.
  const dateArray = Object.keys(infected);

  // snapDate cycles through the length and resets to 0 at the end of the array.
  if (snapDate === dateArray.length) {
      coronaMap.updateChoropleth(null, {reset: true}); // Resets map colors.
      snapDate = 0;
  }

  const snapColors = {};
  for (const country in infected[dateArray[snapDate]]) {
    // If a country in the infected object has cases for given date, it is added to snapColors
    // along with a map color that getColor derives from the numbers of confirmed and death cases.
    if (infected[dateArray[snapDate]][country] + dead[dateArray[snapDate]][country] > 0) {
      const color = getColor(infected[dateArray[snapDate]][country],dead[dateArray[snapDate]][country]);
      snapColors[codeMap[country.split(" (",1)]] = color; // infected country name cleaned up for codeMap.
    }
  }
  
  newDate(dateArray[snapDate]);
  coronaMap.updateChoropleth(snapColors);
  snapDate++;
}


const searchResults = document.getElementById("searchresults");
const statsBody = document.getElementById("tbody");
const tableCountries = [];

/**
 * Fetches data from an URL by using window.fetch.
 * 
 * @param {string} url - URL from which the data is fetched
 * @returns {JSON} - (Promise)
 */
function getJSON(url) {
  return fetch(url).then(response => response.json());
}

/**
 * Modifies the country data so that it is compatible between different end-points.
 *
 * @param {Array<object>} countries - All countries returned from the API
 * @param {Array<object>} initialCodes - Countries that need to be changed
 * @returns {object} - Map of country names to country codes
 */
function countryCodeMap(countries, initialCodes) {
  const codeLookup = initialCodes;
  for (const index in countries) {
    codeLookup[countries[index].name.split(" (",1)] = countries[index].alpha3Code;
  }
  return codeLookup;
}

/**
 * Fills datalist with country names.
 *
 * @param {Array<object>} codeLookup - Country codes and names
 */
function fillDataList(codeLookup) {
  while (searchResults.lastChild) {
    searchResults.removeChild(searchResults.lastChild);
  }
  const countries = Object.keys(codeLookup);
  countries.sort();
  for (const country of countries) {
    const newOption = document.createElement("option");
    newOption.value = country;
    searchResults.appendChild(newOption);
  }
}

/**
 * Constructs an HTML table row.
 * 
 * @param {string} code - country code
 * @returns {string} - HTML table row for country
 */
function constructTableRow(code) {
  if (caseMap[code] !== null && caseMap[code] !== undefined) {
    const reportedTableRow = (
      "<tr><td>" + caseMap[code].country + "</td>"
      + "<td>" + caseMap[code].confirmed + "</td>"
      + "<td>" + caseMap[code].deaths + "</td>"
      + "<td>" + caseMap[code].recovered + "</td></tr>"
    );
    return reportedTableRow;
  }
  else if (getKey(codeMap, code) !== null && getKey(codeMap, code) !== undefined) {
    const unreportedTableRow = "<tr><td>" + getKey(codeMap, code) + "</td><td>-</td><td>-</td><td>-</td></tr>";
    return unreportedTableRow;
  }
  else {
    return "";
  }
}

/**
 * Returns the key for given value in object.
 * 
 * @param {Array<object>} object - Object to search for value
 * @param {string} value  - Value to search for in object
 * @returns {string} - Key for value
 */
function getKey(object, value) {
  for (const key in object) {
    if (object[key] === value) {
      return key;
    }
  }
}

/**
 * @param {Array<object>} cases - All corona cases returned from the API
 * @param {Array<object>} countries - codeMap
 * @returns {object} - Map of country codes to corona cases in the country
 */
function mapCasesWithCountrycodes(cases, countries) {
  const codedCaseMap = {};
  for (const country in cases) {
    // (Underscores in country names from the cases object are replaced with spaces elsewhere.)
    const countryCode = countries[country.replace(/_/g, " ")];
    // Checks that the cases country is found in the countries code map, then
    // the cases entries are added to caseMap under its three letter country code from the code map.
    if (countryCode) {
      codedCaseMap[countryCode] = cases[country];
      codedCaseMap[countryCode].country = country.replace(/_/g, " ");
    }
  }
  return codedCaseMap;
}

/**
 * inputHandler takes care of the search bar functionality.
 * Entered countries populate a table and show with their neighbours on the map.
 * 
 * @param {*} e - Event object from input.
 */
function inputHandler(e) {
  if (codeMap[e.target.value]) {
    // If target value country already exists, it is removed from the list and the list is sorted,
    // the table is then deleted and generated again from the list.
    if (tableCountries.includes(e.target.value)) {
      tableCountries.splice(tableCountries.indexOf(e.target.value),1);
      tableCountries.sort();
      tableCountries.reverse();
      statsBody.innerHTML="";
      for (const index in tableCountries) {
        statsBody.insertAdjacentHTML("afterbegin", constructTableRow(codeMap[tableCountries[index]]));
      }
    }

    const neighbourinos = {};

    // If the entered country has a color definition in countryColor,
    // the country code and color are added to neighbourinos.
    if (countryColor[codeMap[e.target.value]]) {
      neighbourinos[codeMap[e.target.value]] = countryColor[codeMap[e.target.value]];
    }
    // The same is done for each of the neighbouring countries from neighbourMap.
    for (const country of neighbourMap[codeMap[e.target.value]]) {
      if (countryColor[country]) {
        neighbourinos[country] = countryColor[country];
      }
    }

    // Stop timeseries playback if it is active.
    if (timeseriesPlaying) {
      clearInterval(interval);
      timeseriesPlaying = false;
    }

    coronaMap.updateChoropleth(null, {reset: true}); // Reset map.
    coronaMap.updateChoropleth(neighbourinos); // Color selected countries on the map.

    tableCountries.push(e.target.value);
    statsBody.insertAdjacentHTML("afterbegin", constructTableRow(codeMap[e.target.value]));    
    e.srcElement.value = "";
  }
}

// Self-invoked function to avoid polluting global scope
(() => {
  const helloIndex = "Hello from index.js!";
  sayHello(helloIndex);
  console.log(`This is how you can use the configuration object: ${config.baseURL}`);
})();


// Declaring object arrays for use of functions
let codeMap = {};
let caseMap = {};
let neighbourMap= {};
let infected = {};
let dead = {};
const countryColor = {};

(async () => {
  const countries = await getJSON(`${config.baseURL}countries`);
  codeMap = countryCodeMap(countries, INITIAL_CODES);

  const cases = await getJSON(`${config.baseURL}corona`);
  caseMap = mapCasesWithCountrycodes(cases, codeMap);

  const rawNeighbours = await getJSON(`${config.baseURL}neighbours`);
  neighbourMap = mapNeighbours(rawNeighbours);
        
  fillDataList(codeMap);
  
  // countryColor maps country codes to their current up to date map color from getColor.
  for (const country in caseMap) {
    countryColor[country] = getColor(caseMap[country].confirmed, caseMap[country].deaths);
  }

  // The initial load of the map with current date and current coloring worldwide.
  coronaMap.updateChoropleth(countryColor);
  newDate();
  
  // Infected and dead counters
  const timelapseInfectedAndDeceased = await getJSON("https://tie-lukioplus.rd.tuni.fi/corona/api/corona/timeseries");
  infected = peopleStatistic(timelapseInfectedAndDeceased, 0);
  dead = peopleStatistic(timelapseInfectedAndDeceased, 1);

  document.getElementById("country").addEventListener("input", inputHandler);
  document.getElementById("countryform").addEventListener("submit", (e) => e.preventDefault());
})();
