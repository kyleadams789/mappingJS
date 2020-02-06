/*============================================================================
 * FILE:    scriptures.js
 * AUTHOR:  Kyle Adams
 * DATE:    Winter 2020
 *
 * DESCRIPTION: Front-end JavaScript code for The Scriptures mapping project
 */
/*jslint
    browser: true
    long: true */
/*global console, google, map, XMLHttpRequest */
/*property
    Animation, DROP, Marker, animation, books, changeHash, classKey,
    clearTimeout, content, exec, forEach, fullName, getAttribute,
    getElementById, google, gridName, hash, href, id, init, innerHTML, lat,
    length, lng, log, map, maps, maxBookId, minBookId, numChapters,
    onHashChanged, onclick, onerror, onload, open, parentBookId, parse, position, push,
    querySelectorAll, response, send, setMap, setTimeout, showLocation, slice,
    split, status, title, tocName
*/

const Scriptures = (function () {
    "use strict";

    /*------------------------------------------------------------------------
     *              CONSTANTS
     */
    const BOTTOM_PADDING = "<br /><br />";
    const CLASS_BOOKS = "books";
    const CLASS_BUTTON = "btn";
    const CLASS_CHAPTER = "chapter";
    const CLASS_VOLUME = "volume";
    const DIV_BREADCRUMBS = "crumbs";
    const DIV_SCRIPTURES_NAVIGATOR = "scripnav";
    const DIV_SCRIPTURES = "scriptures";
    const INDEX_FLAG = 11;
    const INDEX_LATITUDE = 3;
    const INDEX_LONGITUDE = 4;
    const INDEX_PLACENAME = 2;
    const LAT_LON_PARSER = /\((.*),'(.*)',(.*),(.*),(.*),(.*),(.*),(.*),(.*),(.*),'(.*)'\)/;
    const MAX_RETRY_DELAY = 5000;
    const REQUEST_GET = "GET";
    const REQUEST_STATUS_OK = 200;
    const REQUEST_STATUS_ERROR = 400;
    const TAG_LIST_ITEM = "li";
    const TAG_UNORDERED_LIST = "ul";
    const TAG_VOLUME_HEADER = "h5";
    const TEXT_TOP_LEVEL = "The Scriptures";
    const URL_BOOKS = "https://scriptures.byu.edu/mapscrip/model/books.php";
    const URL_SCRIPTURES = "https://scriptures.byu.edu/mapscrip/mapgetscrip.php";
    const URL_VOLUMES = "https://scriptures.byu.edu/mapscrip/model/volumes.php";

    /*------------------------------------------------------------------------
     *              PRIVATE VARIABLES
     */
    let books;
    let gmMarkers = [];
    let retryDelay = 500;
    let volumes;

    /*------------------------------------------------------------------------
     *              PRIVATE METHOD DECLARATIONS
     */
    let addMarker;
    let ajax;
    let bookChapterValid;
    let booksGrid;
    let booksGridContent;
    let breadcrumbs;
    let cacheBooks;
    let changeHash;
    let chaptersGrid;
    let chaptersGridContent;
    let clearMarkers;
    let encodedScripturesUrlParameters;
    let getScripturesCallback;
    let getScripturesFailure;
    let htmlAnchor;
    let htmlDiv;
    let htmlElement;
    let htmlHashLink;
    let htmlLink;
    let init;
    let navigateBook;
    let navigateChapter;
    let navigateHome;
    let nextChapter;
    let onHashChanged;
    let previousChapter;
    let setupMarkers;
    let showLocation;
    let titleForBookChapter;
    let volumeForId;
    let volumesGridContent;

    /*------------------------------------------------------------------------
     *              PRIVATE METHOD DECLARATIONS
     */
    addMarker = function (placename, latitude, longitude) {
        //TODO - check to see if already have this lat/long in the gmMarkersArray
        //TODO - create marker and append to gmMarkers

        let marker = new google.maps.Marker({
            position: {lat: Number(latitude), lng: Number(longitude)},
            map, //same as <map: map,>
            title: placename,
            animation: google.maps.Animation.DROP
        });
        
        gmMarkers.push(marker);
    };

    ajax = function (url, successCallback, failureCallback, skipJsonParse) {
        let request = new XMLHttpRequest();
        request.open(REQUEST_GET, url, true);

        request.onload = function () {
            if (request.status >= REQUEST_STATUS_OK && request.status < REQUEST_STATUS_ERROR) {
                let data = (
                    skipJsonParse
                    ? request.response
                    : JSON.parse(request.response)
                );

                if (typeof successCallback === "function") {
                    successCallback(data);
                }
            } else {
                if (typeof failureCallback === "function") {
                    failureCallback(request);
                }
            }
        };

        request.onerror = failureCallback;
        request.send();
    };

    bookChapterValid = function (bookId, chapter) {
        let book = books[bookId];

        if (book === undefined || chapter < 0 || chapter > book.numChapters) {
            return false;
        }

        if (chapter === 0 && book.numChapters > 0) {
            return false;
        }

        return true;
    };

    booksGrid = function (volume) {
        return htmlDiv({
            classKey: CLASS_BOOKS,
            content: booksGridContent(volume)
        });
    };

    booksGridContent = function (volume) {
        let gridContent = "";

        volume.books.forEach(function (book) {
            gridContent += htmlLink({
                classKey: CLASS_BUTTON,
                id: book.id,
                href: `#${volume.id}:${book.id}`,
                content: book.gridName
            });
        });

        return gridContent;
    };

    cacheBooks = function (onInitializedCallback) {
        volumes.forEach(function (volume) {
            let volumeBooks = [];
            let bookId = volume.minBookId;

            while (bookId <= volume.maxBookId) {
                volumeBooks.push(books[bookId]);
                bookId += 1;
            }

            volume.books = volumeBooks;
        });

        if (typeof onInitializedCallback === "function") {
            onInitializedCallback();
        }
    };

    chaptersGrid = function (book) {
        return htmlDiv({
            classKey: CLASS_VOLUME,
            content: htmlElement(TAG_VOLUME_HEADER, book.fullName)
        }) + htmlDiv({
            classKey: CLASS_BOOKS,
            content: chaptersGridContent(book)
        });
    };

    chaptersGridContent = function (book) {
        let gridContent = "";
        let chapter = 1;

        while (chapter <= book.numChapters) {
            gridContent += htmlLink({
                classKey: `${CLASS_BUTTON} ${CLASS_CHAPTER}`,
                id: chapter,
                href: `#0:${book.id}:${chapter}`,
                content: chapter
            });

            chapter += 1;
        }

        return gridContent;
    };

    clearMarkers = function () {
        gmMarkers.forEach(function (marker) {
            marker.setMap(null);
        });

        gmMarkers = []; //clear array
    };

    encodedScripturesUrlParameters = function (bookId, chapter, verses, isJst) {
        if (bookId !== undefined && chapter !== undefined) {
            let options = "";

            if (verses !== undefined) {
                options += verses;
            }

            if (isJst !== undefined) {
                options += "&jst=JST";
            }

            return `${URL_SCRIPTURES}?book=${bookId}&chap=${chapter}&verses${options}`;
        }
    };

    getScripturesCallback = function (chapterHtml) {
        document.getElementById(DIV_SCRIPTURES).innerHTML = chapterHtml;
        //NEEDS WORK - setupMarkers();
        setupMarkers();
    };

    getScripturesFailure = function () {
        console.log("Unable to retrieve chapter content from server.");
    };

    htmlAnchor = function (volume) {
        return `<a name="v${volume.id}" />`;
    };

    htmlDiv = function (parameters) {
        let classString = "";
        let contentString = "";
        let idString = "";

        if (parameters.classKey !== undefined) {
            classString = ` class="${parameters.classKey}"`;
        }

        if (parameters.content !== undefined) {
            contentString = parameters.content;
        }

        if (parameters.id !== undefined) {
            idString = ` id="${parameters.id}"`;
        }

        return `<div${idString}${classString}>${contentString}</div>`;
    };

    htmlElement = function (tagName, content) {
        return `<${tagName}>${content}</${tagName}>`;
    };

    htmlLink = function (parameters) {
        let classString = "";
        let contentString = "";
        let hrefString = "";
        let idString = "";
        let onclickString = "";

        if (parameters.classKey !== undefined) {
            classString = ` class="${parameters.classKey}"`;
        }

        if (parameters.content !== undefined) {
            contentString = parameters.content;
        }

        if (parameters.href !== undefined) {
            hrefString = ` href="${parameters.href}"`;
        }

        if (parameters.id !== undefined) {
            idString = ` id="${parameters.id}"`;
        }

        if (parameters.onclick !== undefined) {
            onclickString = ` onclick="${parameters.onclick}"`;
        }

        return `<a${idString}${classString}${hrefString}${onclickString}>${contentString}</a>`;
    };

    init = function (onInitializedCallback) {
        let booksLoaded = false;
        let volumesLoaded = false;

        ajax(URL_BOOKS, function (data) {
            books = data;
            booksLoaded = true;

            if (volumesLoaded) {
                cacheBooks(onInitializedCallback);
            }
        });

        ajax(URL_VOLUMES, function (data) {
            volumes = data;
            volumesLoaded = true;

            if (booksLoaded) {
                cacheBooks(onInitializedCallback);
            }
        });
    };

    navigateBook = function (bookId) {
        let book = books[bookId];
        let volume;

        if (book.numChapters <= 1) {
            navigateChapter(book.id, book.numChapters);
        } else {
            if (book !== undefined) {
                volume = volumeForId(book.parentBookId);
            }

            document.getElementById(DIV_SCRIPTURES).innerHTML = htmlDiv({
                id: DIV_SCRIPTURES_NAVIGATOR,
                content: chaptersGrid(book)
            });
            //document.getElementById(DIV_BREADCRUMBS).innerHTML = breadcrumbs(volume, book);
        }
    };

    navigateChapter = function (bookId, chapter) {
        console.log(nextChapter(bookId, chapter));
        console.log(previousChapter(bookId, chapter));

        ajax(encodedScripturesUrlParameters(bookId, chapter), getScripturesCallback, getScripturesFailure, true);
    };

    navigateHome = function (volumeId) {
        document.getElementById(DIV_SCRIPTURES).innerHTML = htmlDiv({
            id: DIV_SCRIPTURES_NAVIGATOR,
            content: volumesGridContent(volumeId)
        });
    };

    nextChapter = function (bookId, chapter) {
        let book = books[bookId];

        if (book !== undefined) {
            if (chapter < book.numChapters) {
                return [
                    bookId,
                    chapter + 1,
                    titleForBookChapter(book, chapter + 1)
                ];
            }

            let nextBook = books[bookId + 1];

            if (nextBook !== undefined) {
                let nextChapterValue = 0;

                if (nextBook.numChapters > 0) {
                    nextChapterValue = 1;
                }

                return [
                    nextBook.id,
                    nextChapterValue,
                    titleForBookChapter(nextBook, nextChapterValue)
                ];
            }
        }
    };

    onHashChanged = function () {
        let ids = [];

        if (location.hash !== "" && location.hash.length > 1) {
            ids = location.hash.slice(1).split(":");
        }

        if (ids.length <= 0) {
            navigateHome();
        } else if (ids.length === 1) {
            let volumeId = Number(ids[0]);

            if (volumeId < volumes[0].id || volumeId > volumes.slice(-1).id) {
                navigateHome();
            } else {
                navigateHome(volumeId);
            }
        } else if (ids.length >= 2) {
            let bookId = Number(ids[1]);

            if (books[bookId] === undefined) {
                navigateHome();
            } else {
                if (ids.length === 2) {
                    navigateBook(bookId);
                } else {
                    let chapter = Number(ids[2]);

                    if (bookChapterValid(bookId, chapter)) {
                        navigateChapter(bookId, chapter);
                    } else {
                        navigateHome();
                    }
                }
            }
        }
    };

    // Book ID and chapter must be integers
    // Returns undefined if there is no previous chapter
    // Otherwise returns an array with the previous book ID, chapter, and title
    previousChapter = function (bookId, chapter) {
        let book = books[bookId];

        // Get the book for the given bookId.  If it exists (i.e. it’s not undefined):
        if (book !== undefined) {
            //     If chapter > 1, it’s the easy case.
            //     Just return same bookId,
            //     chapter - 1, and the title string for that book/chapter combo.
            if (chapter > 1) {
                return [
                    bookId,
                    chapter - 1,
                    titleForBookChapter(book, chapter - 1)
                ];
            }

            let previousBook = books[bookId - 1];

            //     Otherwise we need to see if there’s a previous book:
            //         Get the book for bookId - 1.  If it exists:
            if (previousBook !== undefined) {
                let previousChapterValue = 0;

                if (previousBook.numChapters > 0) {
                    previousChapterValue = previousBook.numChapters;
                }

                // Return bookId - 1, the last chapter of that book, and the
                //   title string for that book/chapter combo.
                return [
                    bookId - 1,
                    previousChapterValue,
                    titleForBookChapter(previousBook, previousChapterValue)
                ];
            }
        }
        // If we didn’t already return a 3-element array of bookId/chapter/title,
        //     at this point just drop through to the bottom of the function.  We’ll
        //     return undefined by default, meaning there is no previous chapter.
        console.log(bookId, chapter);
    };

    setupMarkers = function () {
        if (window.google === undefined) {
            let retryId = window.setTimeout(setupMarkers, retryDelay);

            retryDelay += retryDelay;

            if (retryDelay > MAX_RETRY_DELAY) {
                window.clearTimeout(retryId);
            }

            return;
        }

        if (gmMarkers.length > 0) {
            clearMarkers();
        }

        document.querySelectorAll("a[onclick^=\"showLocation(\"]").forEach(function (element) {
            let matches = LAT_LON_PARSER.exec(element.getAttribute("onclick"));

            if (matches) {
                let placename = matches[INDEX_PLACENAME];
                let latitude = matches[INDEX_LATITUDE];
                let longitude = matches[INDEX_LONGITUDE];
                let flag = matches[INDEX_FLAG];

                if (flag !== "") {
                    placename += ` ${flag}`;
                }

                addMarker(placename, latitude, longitude);
            }
        });
    };

    
    
    

    showLocation = function (id, placename, latitude) {
        console.log(id);
        console.log(placename);
        console.log(latitude);
        //console.log(arguments);
    };

    //return string showing chapter name (for onHover)
    titleForBookChapter = function (book, chapter) {
        if (book !== undefined) {
            if (chapter > 0) {
                return `${book.tocName} ${chapter}`;
            }

            return book.tocName;
        }
    };

    volumeForId = function (volumeId) {
        if (volumeId !== undefined && volumeId > 0 && volumeId <= volumes.length) {
            return volumes[volumeId - 1];
        }
    };

    volumesGridContent = function (volumeId) {
        let gridContent = "";

        volumes.forEach(function (volume) {
            if (volumeId === undefined || volumeId === volume.id) {
                gridContent += htmlDiv({
                    classKey: CLASS_VOLUME,
                    content: htmlAnchor(volume) + htmlElement(TAG_VOLUME_HEADER, volume.fullName)
                });

                gridContent += booksGrid(volume);
            }
        });

        return gridContent + BOTTOM_PADDING;
    };

    /*------------------------------------------------------------------------
     *              PUBLIC METHODS
     */
    return {
        init,
        onHashChanged,
        showLocation
    };
}());