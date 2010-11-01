/*
 * wiki.js
 * Scripts for the wiki app.
 */

(function ($) {
    var OSES, BROWSERS, VERSIONS, MISSING_MSG;

    function init() {
        $('select.enable-if-js').removeAttr('disabled');

        initPrepopulatedSlugs();
        initActionModals();
        initDetailsTags();

        if ($('body').is('.document') || $('body').is('.home')) { // Document page
            initForTags();
            initHelpfulVote();
        }
        if ($('body').is('.translate')) { // Translate page
            initChangeTranslateLocale();
        }
        if ($('body').is('.edit, .new, .translate')) {
            initArticlePreview();
        }

        Marky.createFullToolbar('.forum-editor-tools', '#id_content');
    }

    // Make <summary> and <details> tags work even if the browser doesn't support them.
    // From http://mathiasbynens.be/notes/html5-details-jquery
    function initDetailsTags() {
        // Note <details> tag support. Modernizr doesn't do this properly as of 1.5; it thinks Firefox 4 can do it, even though the tag has no "open" attr.
        if (!('open' in document.createElement('details'))) {
            document.documentElement.className += ' no-details';
        }

        // Execute the fallback only if there's no native `details` support
        if (!('open' in document.createElement('details'))) {
            // Loop through all `details` elements
            $('details').each(function() {
                // Store a reference to the current `details` element in a variable
                var $details = $(this),
                    // Store a reference to the `summary` element of the current `details` element (if any) in a variable
                    $detailsSummary = $('summary', $details),
                    // Do the same for the info within the `details` element
                    $detailsNotSummary = $details.children(':not(summary)'),
                    // This will be used later to look for direct child text nodes
                    $detailsNotSummaryContents = $details.contents(':not(summary)');

                // If there is no `summary` in the current `details` element...
                if (!$detailsSummary.length) {
                    // ...create one with default text
                    $detailsSummary = $(document.createElement('summary')).text('Details').prependTo($details);
                }

                // Look for direct child text nodes
                if ($detailsNotSummary.length !== $detailsNotSummaryContents.length) {
                    // Wrap child text nodes in a `span` element
                    $detailsNotSummaryContents.filter(function() {
                        // Only keep the node in the collection if it's a text node containing more than only whitespace
                        return (this.nodeType === 3) && (/[^\t\n\r ]/.test(this.data));
                    }).wrap('<span>');
                    // There are now no direct child text nodes anymore -- they're wrapped in `span` elements
                    $detailsNotSummary = $details.children(':not(summary)');
                }

                // Hide content unless there's an `open` attribute
                if (typeof $details.attr('open') !== 'undefined') {
                    $details.addClass('open');
                    $detailsNotSummary.show();
                } else {
                    $detailsNotSummary.hide();
                }

                // Set the `tabindex` attribute of the `summary` element to 0 to make it keyboard accessible
                $detailsSummary.attr('tabindex', 0).click(function() {
                    // Focus on the `summary` element
                    $detailsSummary.focus();
                    // Toggle the `open` attribute of the `details` element
                    if (typeof $details.attr('open') !== 'undefined') {
                        $details.removeAttr('open');
                    }
                    else {
                        $details.attr('open', 'open');
                    }
                    // Toggle the additional information in the `details` element
                    $detailsNotSummary.slideToggle();
                    $details.toggleClass('open');
                }).keyup(function(event) {
                    if (13 === event.keyCode || 32 === event.keyCode) {
                        // Enter or Space is pressed -- trigger the `click` event on the `summary` element
                        // Opera already seems to trigger the `click` event when Enter is pressed
                        if (!($.browser.opera && 13 === event.keyCode)) {
                            event.preventDefault();
                            $detailsSummary.click();
                        }
                    }
                });
            });
        }
    }

    // Return the OS that the cookie indicates or, failing that, that appears
    // to be running. Possible values are {mac, win, linux, maemo, android,
    // undefined}.
    function initialOs() {
        return $.cookie('for_os') || BrowserDetect.OS;
    }

    // Return the browser and version that the cookie indicates or, failing
    // that, that appears to be running. Possible values resemble {fx4, fx35,
    // m1, m11}. Return undefined if the currently running browser can't be
    // identified.
    function initialBrowser() {
        function getVersionGroup(browser, version) {
            if ((browser === undefined) || (version === undefined) || !VERSIONS[browser]) {
                return;
            }

            for (var i = 0; i < VERSIONS[browser].length; i++) {
                if (version < VERSIONS[browser][i][0]) {
                    return browser + VERSIONS[browser][i][1];
                }
            }
        }
        return $.cookie('for_browser') || getVersionGroup(BrowserDetect.browser, BrowserDetect.version);
    }

    // Hide/show the proper page sections that are marked with {for} tags as
    // applying to only certain browsers or OSes. Update the table of contents
    // to reflect what was hidden/shown.
    function initForTags() {

        OSES = $.parseJSON($('select#os').attr('data-oses'));  // {'mac': true, 'win': true, ...}
        BROWSERS = $.parseJSON($('select#browser').attr('data-browsers'));  // {'fx4': true, ...}
        VERSIONS = $.parseJSON($('select#browser').attr('data-version-groups'));  // {'fx': [[3.4999, '3'], [3.9999, '35']], 'm': [[1.0999, '1'], [1.9999, '11']]}
        MISSING_MSG = gettext('[missing header]');  // l10nized "missing header" message

        function updateForsAndToc() {
            // Hide and show document sections accordingly:
            showAndHideFors($('select#os').attr('value'),
                            $('select#browser').attr('value'));

            // Update the table of contents in case headers were hidden or shown:
            $('#toc > :not(h2)').remove(); // __TOC__ generates <ul/>'s.
            $('#toc').append(filteredToc($('#doc-content'), '#toc h2'));

            return false;
        }

        function makeMenuChangeHandler(cookieName) {
            function handler() {
                $.cookie(cookieName, $(this).attr('value'), {path: '/'});
                updateForsAndToc();
            }
            return handler;
        }

        var $osMenu = $('select#os'),
            $browserMenu = $('select#browser'),
            initial;

        $osMenu.change(makeMenuChangeHandler('for_os'));
        $browserMenu.change(makeMenuChangeHandler('for_browser'));

        // Select the sniffed or cookied browser or OS if there is one:
        initial = initialOs();
        if (initial) {
            $osMenu.attr('value', initial);  // does not fire change event
        }
        initial = initialBrowser();
        if (initial) {
            $browserMenu.attr('value', initial);
        }

        // Fire off the change handler for the first time:
        updateForsAndToc();
    }

    function initPrepopulatedSlugs() {
        var fields = {
            title: {
                id: '#id_slug',
                dependency_ids: ['#id_title'],
                dependency_list: ['#id_title'],
                maxLength: 50
            }
        };

        $.each(fields, function(i, field) {
            $(field.id).addClass('prepopulated_field');
            $(field.id).data('dependency_list', field.dependency_list)
                   .prepopulate($(field.dependency_ids.join(',')),
                                field.maxLength);
        });
    }

    /*
     * Initialize modals that activate on the click of elements with
     * class="activates-modal". The activation element is required to
     * have a data-modal-selector attribute that is a CSS selector
     * to the modal to activate (by adding CSS class "active").
     *
     * TODO: Check if other areas of the site can use this and, if so,
     * move to the common bundle somewhere.
     */
    function initActionModals() {
        var $modal, $overlay;
        $('.activates-modal').click(function(ev){
            ev.preventDefault();
            $modal = $($(this).attr('data-modal-selector'));
            $overlay = $('<div id="modal-overlay"></div>');
            if (!$modal.data('inited')) {
                $modal.append('<a href="#close" class="close">&#x2716;</a>')
                    .data('inited', true);
                $modal.find('a.close, a.cancel').click(closeModal);
            }

            $modal.addClass('active');
            $('body').append($overlay);

            return false;
        });

        function closeModal(ev) {
            ev.preventDefault();
            $modal.removeClass('active');
            $overlay.remove();
            return false;
        }
    }

    // Return a table of contents (an <ol>) listing the visible headers within
    // elements in the $pageBody set.
    //
    // The highest header level found within $pageBody is considered to be the
    // top of the TOC: if $pageBody has h2s but no h1s, h2s will be used as the
    // first level of the TOC. Missing headers (such as if you follow an h2
    // directly with an h4) are noted prominently so you can fix them.
    //
    // excludesSelector is an optional jQuery selector for excluding certain
    // headings from the table of contents.
    function filteredToc($pageBody, excludesSelector) {
        function headerLevel(index, hTag) {
            return parseInt(hTag.tagName[1], 10);
        }

        var $headers = $pageBody.find(':header:not(:hidden)'),  // :hidden is a little overkill, but it's short.
            $root = $('<ol />'),
            $cur_ol = $root,
            ol_level = Math.min.apply(Math, $headers.map(headerLevel).get());

        // For each header in the document, look upward until you hit something that's hidden. If nothing is found, add the header to the TOC.
        $headers.each(function addIfShown(index) {
            var h_level = headerLevel(0, this),
                $h = $(this);

            if (excludesSelector && $h.is(excludesSelector)) {
                // Skip excluded headers.
                return;
            }

            // If we're too far down the tree, walk up it.
            for (; ol_level > h_level; ol_level--) {
                $cur_ol = $cur_ol.parent().closest('ol');
            }

            // If we're too far up the tree, walk down it, create <ol>s until we aren't:
            for (; ol_level < h_level; ol_level++) {
                var $last_li = $cur_ol.children().last();
                if ($last_li.length === 0) {
                    $last_li = $('<li />').append($('<em />')
                                                  .text(MISSING_MSG))
                                          .appendTo($cur_ol);
                }
                // Now the current <ol> ends in an <li>, one way or another.
                $cur_ol = $('<ol />').appendTo($last_li);
            }

            // Now $cur_ol is at exactly the right level to add a header by appending an <li>.
            $cur_ol.append($('<li />').text($h.text()).wrapInner($('<a>').attr('href', '#' + $h.attr('id'))));
        });
        return $root;
    }

    // Set the {for} nodes to the proper visibility for the given OS and
    // browser combination.
    //
    // Hidden are {for}s that {list at least one OS but not the passed-in one}
    // or that {list at least one browser but not the passed-in one}. Also, the
    // entire condition can be inverted by prefixing it with "not ", as in {for
    // not mac,linux}.
    function showAndHideFors(os, browser) {
        $('.for').each(function(index) {
            var osAttrs = {}, browserAttrs = {},
                foundAnyOses = false, foundAnyBrowsers = false,
                forData,
                isInverted,
                shouldHide;

            // Catch the "not" operator if it's there:
            forData = $(this).attr('data-for');
            if (!forData) {
                // If the data-for attribute is missing, move on.
                return;
            }

            isInverted = forData.substring(0, 4) == 'not ';
            if (isInverted) {
                forData = forData.substring(4);  // strip off "not "
            }

            // Divide {for} attrs into OSes and browsers:
            $(forData.split(',')).each(function(index) {
                if (OSES.hasOwnProperty(this)) {
                    osAttrs[this] = true;
                    foundAnyOses = true;
                } else if (BROWSERS.hasOwnProperty(this)) {
                    browserAttrs[this] = true;
                    foundAnyBrowsers = true;
                }
            });

            shouldHide = (foundAnyOses && !osAttrs.hasOwnProperty(os)) ||
                         (foundAnyBrowsers && !browserAttrs.hasOwnProperty(browser));
            if ((shouldHide && !isInverted) || (!shouldHide && isInverted)) {
                $(this).hide();  // saves original visibility, which is nice but not necessary
            }
            else {
                $(this).show();  // restores original visibility
            }
        });
    }

    /*
     * Initialize the Change locale link on the translate page
     */
    function initChangeTranslateLocale() {
        // Add the close button to the modal and handle clicks
        $('#change-locale')
            .append('<a href="#close" class="close">&#x2716;</a>')
            .click(function(ev){
                ev.stopPropagation();
            })
            .find('a.close')
                .click(function(e){
                    $('div.change-locale').removeClass('open');
                    e.preventDefault();
                    return false;
                });

        // Open the modal on click of the "change" link
        $('div.change-locale a.change').click(function(ev){
            ev.preventDefault();
            $(this).closest('div.change-locale').addClass('open');
            $('body').one('click', function() {
                $('div.change-locale').removeClass('open');
            });
            return false;
        });
    }

    /*
     * Initialize the article preview functionality.
     */
    function initArticlePreview() {
        $('#btn-preview').click(function(e) {
            var $btn = $(this);
            $btn.attr('disabled', 'disabled');
            $.ajax({
                url: $(this).attr('data-preview-url'),
                type: 'POST',
                data: $('#id_content').serialize(),
                dataType: 'html',
                success: function(html) {
                    $('#preview')
                        .html(html)
                        .find('select.enable-if-js').removeAttr('disabled');
                    initForTags();
                    $btn.removeAttr('disabled');
                },
                error: function() {
                    var msg = gettext('There was an error generating the preview.');
                    $('#preview').html(msg);
                    $btn.removeAttr('disabled');
                }
            });

            e.preventDefault();
            return false;
        });
    }

    /*
     * Ajaxify the Helpful/NotHelpful voting form on Document page
     */
    var voted = false;
    function initHelpfulVote() {
        var $btns = $('#helpful-vote input[type="submit"]');
        $btns.click(function(e) {
            if (!voted) {
                var $btn = $(this),
                    $form = $btn.closest('form'),
                    data = {};
                $btns.attr('disabled', 'disabled');
                $form.addClass('busy');
                data[$btn.attr('name')] = $btn.val();
                $.ajax({
                    url: $btn.closest('form').attr('action'),
                    type: 'POST',
                    data: data,
                    dataType: 'json',
                    success: function(data) {
                        showMessage(data.message, $btn);
                        $btn.addClass('active');
                        $btns.removeAttr('disabled');
                        $form.removeClass('busy');
                        voted = true;
                    },
                    error: function() {
                        var msg = gettext('There was an error generating the preview.');
                        showMessage(msg, $btn);
                        $btns.removeAttr('disabled');
                        $form.removeClass('busy');
                    }
               });
            }

            $(this).blur();
            e.preventDefault();
            return false;
        });
    }

    function showMessage(message, $showAbove) {
        var $html = $('<div class="message-box"><p></p></div>'),
            offset = $showAbove.offset();
        $html.find('p').text(message);
        $('body').append($html);
        $html.css({
            top: offset.top - $html.height() - 30,
            left: offset.left + $showAbove.width()/2 - $html.width()/2
        });
        var timer = setTimeout(fadeOut, 10000);
        $('body').one('click', fadeOut);

        function fadeOut() {
            $html.fadeOut(function(){
                $html.remove();
            });
            $('body').unbind(fadeOut);
            clearTimeout(timer);
        }
    }

    $(document).ready(init);

}(jQuery));