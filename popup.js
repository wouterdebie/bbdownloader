// When the button is clicked, inject setPageBackgroundColor into current page
changeColor.addEventListener("click", async () => {
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: InjectCodeAndRun,
    });
});

// Listener for messages on the popup page
chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
        if (request.message_type == "status_update") {
            document.getElementById("status").innerHTML = request.status;
        }
    }
);

// All code below is injected into the current page. The code that is run first uses the current page
// to get a bunch of data that is needed to iterate over pages going forward. The result is a list of
// Ally page_ids that are then passed on to the service worker that does the actual crawling.
//
// The process is split into two parts because the service worker is not allowed to access the DOM and
// doesn't have access to ufl.infrastructure.com data (like credentials, cookies, storage, etc).
// But the service worker is allowed to create new tabs, which we use to render the final HTML.
async function InjectCodeAndRun () {
    // All of the functions below are inline because they need to be injected into the current page.

    // Convert module items into a bunch of variables that are required to iterate through the pages
    async function getCurrentPageInfo (current_course, asset_id) {
        let module_items = await getModuleItems(current_course, asset_id);
        return {
            current_module_id: module_items.items[0].current.module_id,
            current_id: module_items.items[0].current.id,
            current_page_url: module_items.items[0].current.url,
            next_module_id: module_items.items[0].next.module_id,
            next_id: module_items.items[0].next.id,
            next_page_url: module_items.items[0].next.url
        };
    }

    // Fetch module items for a page based on the asset_id and current_course
    async function getModuleItems (current_course, asset_id) {
        let url = `https://ufl.instructure.com/api/v1/courses/${current_course}/module_item_sequence?asset_type=ModuleItem&asset_id=${asset_id}&frame_external_urls=true`;

        return fetch(url).then((response) => { return response.json() });
    }

    // Send a status message to the popup page
    function sendStatus (status) {
        chrome.runtime.sendMessage({
            message_type: "status_update",
            status: status
        }, null);
    }

    // Get the user_id from the page. Since extensions can't directly read javascript variables from the page,
    // we look for a script tag that sets up the ENV variable that contains the user_id. Rather than interpreting
    // the script, we just parse out the user_id with a regex.
    let user_id = Array.from(document.getElementsByTagName("script")).filter((element) => element.innerHTML.includes("ENV ="))[0].innerHTML.match(/"current_user_id":"(.\d+)"/)[1];

    // After logging in, local storage contains the ID of the current course
    let current_course = window.localStorage.getItem("CURRENT_COURSE_ID");

    // The token that is required to make requests to Ally is stored in the page's session storage
    let token = JSON.parse(window.sessionStorage.getItem(`ally.jwt.603.${current_course}.${user_id}.student`)).token;

    // For the current page, we can get the asset_id from teh page's URL query parameters
    let asset_id = new URLSearchParams(window.location.search).get("module_item_id");

    // Variables needed to iterate through the pages.
    let page_ids = []; // Eventual page ids that will be passed to the service worker
    let i = 0;         // Counter for the number of pages that have been processed
    let page_info;     // Current page info used to iterate through the pages

    // Iterate through the pages and stop when the module_id changes. On
    do {
        i++;
        sendStatus(`Getting page ${i}...`);
        page_info = await getCurrentPageInfo(current_course, asset_id);

        // page_info.current_page_url contains additional metadata about the current page that
        // includes the page_id we require to make calls to Ally.
        let metadata = await fetch(page_info.current_page_url, { redirect: 'follow' })
            .then((response) => { return response.json() });
        let page_id = metadata.page_id;

        // Only pages with a page ID can be downloaded as Beeline HTML. When
        // found, the page
        if (page_id) {
            page_ids.push(page_id);
        }

        // Setup for the next iteration
        asset_id = page_info.next_id;
    } while (page_info.current_module_id == page_info.next_module_id);

    // Send all the page_ids to the service worker
    chrome.runtime.sendMessage({
        message_type: "crawl_pages",
        page_ids: page_ids,
        current_course: current_course,
        token: token
    }, null);
}





