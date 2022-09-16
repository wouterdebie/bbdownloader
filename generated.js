// Listen to incoming messages from the service worker
chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
        // Loop over each piece of content and parse it into a DOM object
        request.content.forEach(c => {
            let parser = new DOMParser();
            let doc = parser.parseFromString(c, "text/html");
            // We're only interested in the <main> tag
            let main = doc.getElementsByTagName("main")[0];

            // Move each child element of the <main> tag to the <main> tag of the current page
            Array.from(main.children).forEach(child => {
                document.getElementsByTagName("main")[0].appendChild(child);

                // Add a page break after each page for printing
                let pb = document.createElement("div");
                pb.classList.add("pagebreak");
                document.getElementsByTagName("main")[0].appendChild(pb);
            });
        });
    }
);
