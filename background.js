// The service worker crawls data from Ally based on page_ids it gets from the popup page. It then
// opens a new tab that will render the final HTML. We can't render the final HTML here, because the
// service worker doesn't have access to the DOM and therefore can't instanciate a new DOMParser.

// Grab data from Ally based on the page_id. This is a two stage process, where the first request is to the Ally API
// and has to be authenticated. The API response contains an AWS URL where the actual HTML file is stored. This
// is an unauthenticated URL, so we can just fetch it and get the HTML.
//
// This function returns a promise that resolves to the HTML content of the page.
async function getAllyData (current_course, page_id, token) {
    let url = `https://prod.ally.ac/api/v1/603/courses/${current_course}/rich-content/${encodeURIComponent(`page:${page_id}`)}/formats/Beeline?acceptTOU=true&formatParam=&asAttachment=false&contentHash=`;

    const headers = { "authorization": "Bearer " + token };
    return fetch(url, { headers })
        .then((response) => response.json()) // initial response from Ally API
        .then((obj) => obj.url)
        .then((url) => fetch(url)) // fetch the HTML file from the AWS URL
        .then((response) => response.text());
}

// Listener for messages on the popup page
function sendStatus (status) {
    chrome.runtime.sendMessage({
        message_type: "status_update",
        status: status
    }, null);
}

// Get the HTML page contents for all page_ids, open a new tab and send a list of HTML pages to the new tab.
// This function requests the HTML pages in parallel to speed up the process.
async function getPageContents (request) {
    // Page ordering matters, but since we're downloading the pages in parallel, we can't rely on the order,
    // so we keep track of the order in a separate array, that's a copy of the page_ids array.
    // After the content is downloaded, we replace index using the page_id into the content array.
    let content = [...request.page_ids];

    // Array to gather promises for each page
    let requests = [];

    // Create a promise for each page and add it to the requests array
    for (let page_id of request.page_ids) {
        requests.push(
            getAllyData(request.current_course, page_id, request.token) // get the HTML content
                .then((data) =>
                    content[content.indexOf(page_id)] = data // replace the index with the HTML content
                )
        );
    }

    sendStatus("Getting page contents...");

    // Wait for all promises to resolve
    await Promise.all(requests);

    // Open a new tab and send the HTML contents to it
    chrome.tabs.create({ url: chrome.runtime.getURL("generated.html") }, (tab) => {
        chrome.tabs.onUpdated.addListener(function (tab_id, info) {
            if (tab_id == tab.id && info.status === 'complete') { // wait for the tab to load
                chrome.tabs.sendMessage(tab.id, { content: content }, null);
            }
        });

    })
}

// Listen for messages from the popup page
chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
        if (request.message_type === "crawl_pages") {
            getPageContents(request);
        }
    }
);

