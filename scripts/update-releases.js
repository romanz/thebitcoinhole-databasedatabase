const fs = require('fs');
const { exit } = require('process');
const axios = require('axios');
const util = require('util');
const path = require('path');

const dateOptions = { year: 'numeric', month: 'short', day: 'numeric' };

const sleep = util.promisify(setTimeout);

async function processReleases() {
    const dirs = fs.readdirSync("../item-types/", { withFileTypes: true })
        .filter(dirent => dirent.isDirectory());

    for (const dirent of dirs) {
        const itemType = dirent.name;
        const path = `../item-types/${itemType}/json/check-releases.json`;

        try {
            if (fs.existsSync(path)) {
                const data = fs.readFileSync(path, 'utf8');
                const json = JSON.parse(data);

                for (const key of Object.keys(json)) {
                    await fetchRelease(itemType, json[key]);
                    await sleep(500);
                }
            }
        } catch (err) {
            console.error(`Error reading or parsing ${path}:`, err);
            process.exit(1);
        }
    }
}

processReleases();

function fetchRelease(itemType, json) {

    const itemId = json["item-id"]
    const platforms = json.platforms
    const changelogUrl = json["changelog-url"]
    const githubOwner = json["github-org"]
    const githubRepo = json["github-repo"]
    const gitlabProjectId = json["gitlab-project-id"]
    const tag = json.tag
    const latestRelease = json["latest-release"]
    const allReleases = json["all-releases"]
    const allReleasesInclude = json["all-releases-include"]
    const allReleasesExclude = json["all-releases-exclude"]
    const assetsMatch = json["assets-match"]
    
    const githubApiKey = process.env.GITHUB_TOKEN
    const gitlabApiKey = process.env.GITLAB_TOKEN
    
    var headers = {
        Accept: 'application/vnd.github.v3+json',
        Authorization: `Bearer ${githubApiKey}`,
      };
    var apiUrl 
    if (tag == true) {
        if (gitlabProjectId != undefined) {
            headers = {
                Authorization: `Bearer ${gitlabApiKey}`
              };
            apiUrl = `https://gitlab.com/api/v4/projects/${gitlabProjectId}/repository/tags`;
        } else {
            apiUrl = `https://api.github.com/repos/${githubOwner}/${githubRepo}/tags`;
        }
    } else if (latestRelease == true) {
        apiUrl = `https://api.github.com/repos/${githubOwner}/${githubRepo}/releases/latest`;
    } else if (allReleases == true) {
        apiUrl = `https://api.github.com/repos/${githubOwner}/${githubRepo}/releases`;
    } else if (changelogUrl != undefined) {
        apiUrl = changelogUrl
        headers = {}
    } else {
        console.error(`${json["item-id"]} - Not defined api url to use`);
        exit(1);
    }
    
    var latestVersion
    var latestReleaseDate
    // var assetFileNames = [];
    
    axios
      .get(apiUrl, { headers })
      .then((response) => {
    
        console.log('---------------------');
        console.log(`Item Id: ${json["item-id"]}`);
        console.log("Request url: " + apiUrl)

        // var assets = []
        var body = ""
        if (latestRelease == true) {
            console.log("Using latest releases API")
            body = response.data.body
    
            latestReleaseDate = getDate(response.data.published_at)
            //assets = response.data.assets
            latestVersion = response.data.name.trim()
            console.log("Release name: " + latestVersion)
            if (latestVersion === undefined || latestVersion === "") {
                latestVersion = response.data.tag_name.trim()
                console.log("Tag name: " + latestVersion)
            }
        } else if (allReleases == true) {
            console.log("Using releases API")
            response.data.forEach((release) => {
                if (latestVersion === undefined) {
                    var match = false
                    if (allReleasesInclude != undefined) {
                        match = release.name.toLowerCase().includes(allReleasesInclude.toLowerCase())
                    } else if (allReleasesExclude != undefined) {
                        match = !release.name.toLowerCase().includes(allReleasesExclude.toLowerCase())
                    } else if (assetsMatch != undefined) {
                        release.assets.forEach((asset) => {
                            if (asset.name.endsWith(assetsMatch)) {
                                match = true
                            }
                        });
                    } else {
                        console.error('Not defined any allReleasesInclude or allReleasesExclude or assetsMatch');
                        exit(1);
                    }
                    if (match) {
                        body = release.body
                        latestReleaseDate = getDate(release.published_at)
                        //assets = release.assets
                        latestVersion = release.name.trim()
                        console.log("Release name: " + latestVersion)
                        if (latestVersion === undefined || latestVersion === "") {
                            latestVersion = release.tag_name
                            console.log("Tag name: " + latestVersion)
                        }
                    }
                }
            });
        } else if (tag == true) {
            console.log("Using tags API")
            const tags = response.data;
            latestTag = tags[0];

            for (const tag of tags) {
                if (latestVersion == undefined && !tag.name.trim().includes("$(MARKETING_VERSION)")) {
                    latestVersion = tag.name.trim()
                }
            }

            console.log("Tag name: " + latestVersion)
            latestReleaseDate = today()
        } else if (changelogUrl != undefined) {
            var body = response.data
            // Split the content into lines
            const lines = body.split('\n');
    
            if (itemId == "parmanode") {
                const regex = /^Version ([\d.]+)/;
                for (const line of lines) {
                    // Skip empty lines and lines starting with #
                    if (line.trim() === "" || line.trim().startsWith("#")) {
                        continue;
                    }
                
                    const match = line.match(regex);
                    if (match) {
                        latestVersion = match[1];
                        latestReleaseDate = today();
                        break; // Stop after finding the first valid version line
                    }
                }
            } else if (itemId.startsWith("mynode-")) {
                // === v0.3.25 ===
                // - Released 1/11/24
                var line = lines[0]
                regex = /^=== v([\d.]+) ===/;
                var match = line.match(regex);
                if (match) {
                    latestVersion = match[1];
                    line = lines[1]
                    regex = /^- Released ([\d.]+)\/([\d.]+)\/([\d.]+)/;
                    if (match) {
                        match = line.match(regex);
                        latestReleaseDate = `${getShortMonthByIndex(parseInt(match[1]) - 1)} ${match[2]}, ${2000 + parseInt(match[3])}`;
                    }
                }
            } else if (itemId.startsWith("nodl-")) {
                const line = lines[0]
                const regex = /^([\d.]+) -/;
                const match = line.match(regex);
                if (match) {
                    latestVersion = match[1];
                    latestReleaseDate = today();
                }
            } else if (itemId == "coolwallet-pro") {
                // Coolwallet Pro. Example: ## [332] - 2023-08-10
                const regex = /^## \[([\d]+)\] - (\d{4}-\d{2}-\d{2})/;
                for (const line of lines) {
                    const match = line.match(regex);
                    if (match) {
                        latestVersion = match[1];
                        latestReleaseDate = formatYYYYMMDD(match[2]);
                        break;
                    }
                }
            } else if (itemId == "coldcard-mk4") {
                // Coldcard Mk4. Example: ## 5.2.2 - 2023-12-21
                const regex = /^## ([\d.]+) - (\d{4}-\d{2}-\d{2})/;
                var onSection = false
                for (const line of lines) {
                    if (onSection == true) {
                        const match = line.match(regex);
                        if (match) {
                            latestVersion = match[1];
                            latestReleaseDate = formatYYYYMMDD(match[2]);
                            break;
                        }
                    } else if (line == "# Mk4 Specific Changes") {
                        onSection = true
                    }
                }
            } else if (itemId == "coldcard-q") {
                // Coldcard Q. Example: ## 0.0.6Q - 2024-02-22
                const regex = /^## ([\d.]+)Q - (\d{4}-\d{2}-\d{2})/;
                var onSection = false
                for (const line of lines) {
                    if (onSection == true) {
                        const match = line.match(regex);
                        if (match) {
                            latestVersion = match[1];
                            latestReleaseDate = formatYYYYMMDD(match[2]);
                            break;
                        }
                    } else if (line == "# Q Specific Changes") {
                        onSection = true
                    }
                }
            } else if (itemId == "trezor-model-t" || itemId.startsWith("trezor-safe-3") || itemId.startsWith("trezor-safe-3-btc-only")) {
                // Example: ## [2.7.0] (20th March 2024) or ## [2.8.5] (internal release)
                const regex = /^## \[([\d.]+)\] \((\d{1,2}(?:st|nd|rd|th) \w+ \d{4}|internal release)\)/;
                for (const line of lines) {
                    const match = line.match(regex);
                    if (match) {
                        latestVersion = match[1];
                        latestReleaseDate = formatDDMonthYYYY(match[2]);
                        if (match[2] === "internal release") {
                            latestReleaseDate = today()
                        } else {
                            latestReleaseDate = formatDDMonthYYYY(match[2]);
                        }
                        break;
                    }
                }
            } else if (itemId == "trezor-model-one") {
                // Example: ## 1.12.1 [15th March 2023]
                const regex = /^## ([\d.]+) \[(\d{1,2}\w\w \w+ \d{4})\]/;
                for (const line of lines) {
                    const match = line.match(regex);
                    if (match) {
                        console.log("Matched line: " + line)
                        latestVersion = match[1];
                        latestReleaseDate = formatDDMonthYYYY(match[2]);
                        break;
                    }
                }
            } else if (itemId == "muun") {
                // ## [51.5] - 2023-12-22
                const regex = /^## \[([\d.]+)\] - (\d{4}-\d{2}-\d{2})/;
                for (const line of lines) {
                    const match = line.match(regex);
                    if (match) {
                        console.log("Matched line: " + line)
                        latestVersion = match[1];
                        latestReleaseDate = formatYYYYMMDD(match[2]);
                        break;
                    }
                }
            } else if (itemId == "electrum") {
                // # Release 4.4.6 (August 18, 2023) (security update)
                // Find the first line starting with "#"
                const regex = /^# Release ([\d.]+) \(([^)]+)\)/;
                for (const line of lines) {
                    const match = line.match(regex);
                    if (match) {
                        console.log("Matched line: " + line)
                        latestVersion = match[1];
                        latestReleaseDate = formatMonthDDYYYY(match[2]);
                        break;
                    }
                }
            } else {
                console.error("Date parser not found")
                exit(1);
            }
            
            if (latestVersion == undefined) {
                console.error("latestVersion not found")
                exit(1);
            }
    
            if (latestReleaseDate == undefined) {
                console.error("latestReleaseDate not found")
                exit(1);
            }
        }
    
        if (!ignoreVersion(itemId, latestVersion)) {

            if (itemType == "bitcoin-nodes") {
                // MiniBolt
                latestVersion = latestVersion.replace(/^MiniBolt /, '');
        
                // Bitcoin Core
                latestVersion = latestVersion.replace(/^Bitcoin Core /, '');
        
                // Bitcoin Knots
                latestVersion = latestVersion.replace(/^Bitcoin Knots /, '');
                latestVersion = latestVersion.replace(/knots/, '');
        
                // Umbrel
                latestVersion = latestVersion.replace(/^umbrelOS /, '');

                // Raspibolt
                latestVersion = latestVersion.replace(/^RaspiBolt /, '');
            } else if (itemType == "hardware-wallets") {
    
                // Bitbox
                latestVersion = latestVersion.replace(/ - Multi$/, '');
                latestVersion = latestVersion.replace(/ - Bitcoin-only$/, '');
    
                // OneKey
                latestVersion = latestVersion.replace(/^mini\//, '');
                latestVersion = latestVersion.replace(/^classic\//, '');
                latestVersion = latestVersion.replace(/^touch\//, '');
    
                // Passport
                latestVersion = latestVersion.replace(/^Passport Firmware /, '');
                latestVersion = latestVersion.replace(/^Passport /, '');
                latestVersion = latestVersion.replace(/ Firmware$/, '');
    
                // ProKey
                latestVersion = latestVersion.replace(/^Prokey Firmware /, '');
    
                // Keepkey
                latestVersion = latestVersion.replace(/^Release /, '');
    
                // Krux
                latestVersion = latestVersion.replace(/^Version /, '');
    
                // Keystone
                latestVersion = latestVersion.replace(/-BTC$/, '');
    
                // Grid+ Lattice1
                latestVersion = latestVersion.replace(/^HSM-/, '');
    
                // Satochip
                const match = latestVersion.match(/^Satochip (v\d+(\.\d+)+)/)
                if (match) {
                    latestVersion = match[1];
                }
            } else if (itemType == "software-wallets") {

                // Bitcoin Core
                latestVersion = latestVersion.replace(/^Bitcoin Core /, '');

                // Bitcoin Keeper
                latestVersion = latestVersion.replace(/^Keeper Desktop /, '');
    
                // My Cytadel: Version 1.5 (Blazing Venus)
                latestVersion = latestVersion.replace(/^Version (\d+(\.\d+)+) \(.*\)$/, '$1');
    
                // Zeuz: v0.8.5-hotfix
                latestVersion = latestVersion.replace(/-hotfix$/, '');
    
                // Proton Wallet: v1.0.0+58
                latestVersion = latestVersion.replace(/\+\d+$/, '');
    
                // Nunchuk: android.1.9.46
                latestVersion = latestVersion.replace(/^android./, '');
    
                // Phoenix
                if (itemId == "phoenix") {
                    latestVersion = latestVersion.replace(/^Android /, '');
                    latestVersion = latestVersion.replace(/^Phoenix Android /, '');
                    latestVersion = latestVersion.replace(/^Phoenix /, '');
                    latestVersion = latestVersion.replace(/^Phoenix Android\/iOS /, '');
                }
    
                // Specter
                latestVersion = latestVersion.replace(/^Specter /, '');
    
                // Stack Wallet
                latestVersion = latestVersion.replace(/^Stack Wallet /, '');
    
                // Wasabi v2.0.4 - Faster Than Fast Latest
                latestVersion = latestVersion.replace(/^Wasabi v(\d+(\.\d+)+) - .*$/, '$1');
                latestVersion = latestVersion.replace(/^Wasabi Wallet v(\d+(\.\d+)+) - .*$/, '$1');
                latestVersion = latestVersion.replace(/^Wasabi Wallet v(\d+(\.\d+)+)*$/, '$1');

                // 2.7.14-1035
                if (itemId == "muun") {
                    latestVersion = latestVersion.split("-")[0]
                }
            }

            // For example: "2023-09-08T2009-v5.1.4"
            latestVersion = latestVersion.replace(/.*-([^:]+)$/, '$1');
    
            latestVersion = latestVersion.replace(/^(v\d+(\.\d+)+):(.*)$/, '$1');
            latestVersion = latestVersion.replace(/^Android Release\s*/, '');
            latestVersion = latestVersion.replace(/^Release\s*/, '');
            latestVersion = latestVersion.replace(/^release_/, '');

            latestVersion = latestVersion.replace(/^v\./, '');
    
            // Check if the input starts with "v" and is a valid version (x.y.z)
            const versionPattern = /^v\d+(\.\d+)*$/;
            if (!versionPattern.test(latestVersion)) {
                // If it doesn't match the version pattern, add the "v" prefix
                latestVersion = "v" + latestVersion;
            }
    
            if (!isValidVersion(latestVersion)) {
                console.error('Invalid version found: ' + latestVersion);
                exit(1);
            }
    
            if (!isValidDate(latestReleaseDate)) {
                console.error('Invalid release data found: ' + latestReleaseDate);
                exit(1);
            }
    
            // Iterate through release assets and collect their file names
            // assets.forEach((asset) => {
            //     assetFileNames.push(asset.name);
            // });
            //console.log('Release Notes:\n', body);
            //console.log('Asset File Names:', assetFileNames.join());
            checkRelease(itemType, json, latestVersion, latestReleaseDate);
        } else {
            console.log("Ignoring version")
        }
      })
      .catch((error) => {
        console.error('Error fetching release information:', error.message);
        exit(1);
      });
}

function checkRelease(itemType, json, latestVersion, latestReleaseDate) {
    // Define the path to your JSON file.
    const filePath = `../item-types/${itemType}/items/${json["item-id"]}.json`;

    // Read the JSON file.
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading JSON file:', err);
            exit(1);
        }

        try {
            const item = JSON.parse(data);

            var releaseVersion
            var releaseDate
            if (itemType == "software-wallets") {
    
                // TODO For Bluewallet, some versions are not for all the platforms. Inspect the assets to see which platform to update
                json.platforms.forEach(platform => {
                    console.log(platform + ":")
                    var currentVersion = item[`${platform}-support`][`${platform}-latest-version`].value
                    var currentReleaseDate = item[`${platform}-support`][`${platform}-latest-release-date`].value
                    console.log("- Current version found: " + currentVersion + " (" + currentReleaseDate + ")")
                    console.log("-  Latest version found: " + latestVersion + " (" + latestReleaseDate + ")")
    
                    if (latestVersion !== currentVersion) {
                        releaseVersion = latestVersion
                        releaseDate = latestReleaseDate
                    }
                });
            } else {
                var currentVersion = item["firmware"]["latest-version"].value
                var currentReleaseDate = item["firmware"]["latest-release-date"].value
                console.log("- Current version found: " + currentVersion + " (" + currentReleaseDate + ")")
                console.log("-  Latest version found: " + latestVersion + " (" + latestReleaseDate + ")")

                
                if (latestVersion !== currentVersion) {
                    releaseVersion = latestVersion
                    releaseDate = latestReleaseDate
                }
            }

            if (releaseVersion != undefined) {
                updateRelease(itemType, json, releaseVersion, releaseDate)
            } else {
                console.log("Not new release found")
            }
            console.log('---------------------');

        } catch (parseError) {
            console.error('Error parsing JSON:', parseError);
            exit(1);
        }
    });
}

function updateRelease(itemType, json, releaseVersion, releaseDate) {
    if (releaseVersion == undefined) {
        console.error('Missing releaseVersion');
        exit(1);
    }

    if (releaseDate == undefined) {
        console.error('Missing releaseDate');
        exit(1);
    }
       
    const filePath = `../item-types/${itemType}/items/${json["item-id"]}.json`;
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading JSON file:', err);
            exit(1);
        }
    
        try {
            const item = JSON.parse(data);
            var modifyJson = false
            var currentVersion
            var currentReleaseDate
            var changelogUrl

            if (itemType == "software-wallets") {
                // TODO For Bluewallet, some versions are not for all the platforms. Inspect the assets to see which platform to update

                json.platforms.forEach(platform => {
                    currentVersion = item[`${platform}-support`][`${platform}-latest-version`].value
                    currentReleaseDate = item[`${platform}-support`][`${platform}-latest-release-date`].value
                    if (releaseVersion !== currentVersion) {
                        item[`${platform}-support`][`${platform}-latest-version`].value = releaseVersion
                        item[`${platform}-support`][`${platform}-latest-release-date`].value= releaseDate
                        modifyJson = true

                        if (item[`${platform}-support`][`${platform}-release-notes`]["links"] && 
                            item[`${platform}-support`][`${platform}-release-notes`]["links"].length > 0) {                            
                                changelogUrl = item[`${platform}-support`][`${platform}-release-notes`]["links"][0]["url"];
                                console.log(`Changelog url (${platform}): ` + changelogUrl);
                        }
                    }
                });
            } else {
                currentVersion = item["firmware"]["latest-version"].value
                currentReleaseDate = item["firmware"]["latest-release-date"].value
                if (releaseVersion !== currentVersion) {
                    item["firmware"]["latest-version"].value = releaseVersion
                    item["firmware"]["latest-release-date"].value = releaseDate
                    modifyJson = true

                    if (item[`firmware`][`release-notes`]["links"] && item[`firmware`][`release-notes`]["links"].length > 0) {
                        changelogUrl = item[`firmware`][`release-notes`]["links"][0]["url"]
                        console.log("Changelog url: " + changelogUrl);
                    }
                }
            }
    
            if (modifyJson) {
                console.log("Updating JSON")
    
                // Convert the modified object back to a JSON string.
                const updatedJsonString = JSON.stringify(item, null, 2);
    
                // Write the updated JSON string back to the file.
                fs.writeFile(filePath, updatedJsonString, (writeErr) => {
                    if (writeErr) {
                        console.error('Error writing JSON file:', writeErr);
                        exit(1);
                    } else {
                        console.log('JSON file updated successfully.');
                    }
                });
    
                if (json.platforms != undefined) {
                    json.platforms.forEach(platform => {
                        updateReleasesFile(itemType, json["item-id"], releaseDate, releaseVersion, changelogUrl, platform);
                    });
                } else {
                    updateReleasesFile(itemType, json["item-id"], releaseDate, releaseVersion, changelogUrl, "");
                }
    
            } else {
                console.error('Error updating JSON. Both versions are the same');
                exit(1);
            }
    
        } catch (parseError) {
            console.error('Error parsing JSON:', parseError);
            exit(1);
        }
    });
}

const longMonths = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

const shortMonths = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

function getShortMonthByIndex(index) {
    return shortMonths[index]
}

function getShortMonth(date) {
    return shortMonths[date.getMonth()]
}

function getLongMonthIndex(month) {
    return longMonths.indexOf(month)
}

function isValidVersion(str) {
    const regex = /^v\d+(\.\d+)*$/;
    return regex.test(str);
}

function isValidDate(str) {
    const regex = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) [1-9]|[1-2][0-9]|3[01], \d{4}$/;
    return regex.test(str);
}

function updateReleasesFile(itemType, itemId, date, version, changelogUrl, platform) {
    const fileName = `releases.md`;
    const filePath = path.join(__dirname, "..", fileName);

    let content = "";
    if (fs.existsSync(filePath)) {
        content = fs.readFileSync(filePath, 'utf8');
    }

    const typeHeader = `## ${itemType}`;
    const idHeader = `### ${itemId}`;
    const versionString = platform !== "" ? `${version} (${platform})` : version;
    const newEntry = `- ${date} - ${versionString} - ${changelogUrl}`;

    // If the type doesn't exist, add the full structure
    if (!content.includes(typeHeader)) {
        content += `\n${typeHeader}\n${idHeader}\n${newEntry}\n`;
    } else {
        // Type exists, check if the ID exists within that type
        const typeSectionRegex = new RegExp(`(${typeHeader}[\\s\\S]*?)(?=\\n## |$)`, 'g');
        content = content.replace(typeSectionRegex, (typeSection) => {
            if (typeSection.includes(idHeader)) {
                // ID exists, append the new entry if it's not already present
                const idSectionRegex = new RegExp(`(${idHeader}\\n)([\\s\\S]*?)(?=\\n### |\\n## |$)`);
                return typeSection.replace(idSectionRegex, (match, header, entries) => {
                    if (!entries.includes(newEntry)) {
                        return `${header}${entries.trim()}\n${newEntry}\n`;
                    }
                    return match;
                });
            } else {
                // ID does not exist, add it to the type section
                return `${typeSection.trim()}\n${idHeader}\n${newEntry}\n`;
            }
        });
    }

    fs.writeFileSync(filePath, content.trim() + "\n", 'utf8');
    console.log(`Updated ${fileName} with new entry.`);
}

function getDate(publishedAt) {
    if (publishedAt != "") {
        return new Date(publishedAt).toLocaleDateString(undefined, dateOptions);
    } else {
        return today()
    }
}

function ignoreVersion(itemId, latestVersion) {

    // Ignore if it ends with "-pre1", "-pre2", etc.
    var pattern = /-pre\d+$/;
    if (pattern.test(latestVersion)) {
        return true
    }

    // Ignore if contains the word beta
    if (latestVersion.toLowerCase().includes("beta")) {
        return true
    }

    // Seedsigner
    if (itemId == "seedsigner" && latestVersion.endsWith("_EXP")) {
        return true
    }

    // Ignore if it ends with "-rc", "-rc1", "-rc2", etc.
    pattern = /-rc\d*$/;
    if (pattern.test(latestVersion)) {
        return true
    }

    return false
}

function today() {
    return new Date().toLocaleDateString(undefined, dateOptions);
}

// Input format: March 14, 2024
function formatMonthDDYYYY(inputDate) {
    // Split the input date string into parts
    const parts = inputDate.match(/^(\w+)\s(\d{1,2}),\s(\d{4})$/);

    if (parts && parts.length === 4) {
        const year = parseInt(parts[3]);
        const monthIndex = getLongMonthIndex(parts[1]);
        const day = parseInt(parts[2]);

        // Create a JavaScript Date object
        const date = new Date(year, monthIndex, day);

        // Format the date in the desired output format (e.g., "Dec 22, 2023")
        return `${getShortMonth(date)} ${date.getDate()}, ${date.getFullYear()}`;
    }

    // Return the original input if parsing fails
    return inputDate;
}

// Input format: 15th March 2023
function formatDDMonthYYYY(inputDate) {
    // Split the input date string into parts
    const parts = inputDate.match(/^(\d{1,2})(st|nd|rd|th)\s(\w+)\s(\d{4})$/);

    if (parts && parts.length === 5) {
        const day = parseInt(parts[1]);
        const monthIndex = getLongMonthIndex(parts[3]);
        const year = parseInt(parts[4]);

        // Create a JavaScript Date object
        const date = new Date(year, monthIndex, day);

        // Format the date in the desired output format (e.g., "Dec 22, 2023")
        return `${getShortMonth(date)} ${date.getDate()}, ${date.getFullYear()}`;
    }

    // Return the original input if parsing fails
    return inputDate;
}

// Input format: 2023-12-22
function formatYYYYMMDD(inputDate) {
    // Split the input date string into parts
    const parts = inputDate.match(/(\d{4})-(\d{2})-(\d{2})/);

    if (parts && parts.length === 4) {
        const year = parseInt(parts[1]);
        const monthIndex = parseInt(parts[2]) - 1; // JavaScript Date months are 0-based
        const day = parseInt(parts[3]);

        // Create a JavaScript Date object
        const date = new Date(year, monthIndex, day);

        // Format the date in the desired output format (e.g., "Dec 22, 2023")
        return `${getShortMonth(date)} ${date.getDate()}, ${date.getFullYear()}`;
    }

    // Return the original input if parsing fails
    return inputDate;
}
