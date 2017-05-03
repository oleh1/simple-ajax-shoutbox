jQuery(document).ready(function($) {
	var browserSupportsPlaceholder = ('placeholder' in document.createElement('input'));

	var defaults = {
		"ajaxurl"               : window.location.origin + "\/wp-admin\/admin-ajax.php", // standard WordPress ajax URL
		"reload_time"           : "30",
		"max_messages"          : "20",
		"max_msglen"            : "255",
		"request_error_text"    : "Request error",
		"max_msglen_error_text" : "Max length of message is %maxlength% characters, length of your message is %length% characters. Please shorten it.",
		"name_empty_error_text" : "Name empty.",
		"msg_empty_error_text"  : "Message empty.",
		"delete_message_text"   : "Delete this message?"
	};
	SimpleAjaxShoutbox = $.extend({}, defaults, SimpleAjaxShoutbox); // merge SimpleAjaxShoutbox with default values

	var active = true;
	var doNotUpdateLock = false;
	var reloadInProgress = false;

	/* reload function for chatbox contents */
	function sb_reload(widget_id, force) {
		reloadInProgress = true;
		var widget   = $("#" + widget_id);

		if (!active && !$('.icons .speaker', widget).hasClass('active') && intervalID) {
			clearInterval(intervalID);
			intervalID = 0;
			return;
		}

		var messages = $("div#sb_messages", widget);
		if (widget.data("lock") && !force) return;
		var widget_num = widget_id.substring(widget_id.lastIndexOf("-")+1);
		$(".icons .warning", widget).hide();

		$.ajax({
			url: SimpleAjaxShoutbox.ajaxurl,
			type: "POST",
			cache: false,
			data: {
				'action': 'shoutbox_refresh',
				'm'     : $(widget).data("msgTotal"),
				'id'    : widget_num
			},
			beforeSend: function() {
				$(".icons .spinner", widget).css("display", "inline-block");
			},
			error: function() {
				$(".icons .spinner", widget).hide();
				$(".icons .warning", widget).show();
			},
			success: function(data) {
				if (reloadInProgress) {
					var reverse_order = messages.hasClass("reverse-order"),
							scrollBottom = messages[0].scrollHeight - messages[0].scrollTop - messages[0].offsetHeight;
					if (messages.hasClass('empty')) doNotUpdateLock = true;
					messages.after('<div style="display:none" id="msgs_placeholder"></div>');
					var placeholder = $("#msgs_placeholder", widget);
					placeholder.html(data);
					var nw = placeholder.children().last(),
							ex = reverse_order ? messages.children().first() : messages.children().last(), 
							ex1, nw_id, nw_no, ex_id, ex_no,
							new_stuff = false;
					while (nw.length > 0) {
						nw_id = nw.attr('id');
						if (nw_id) {
							nw_no = nw_id.substring(nw_id.lastIndexOf("_")+1);
							while (ex.length > 0) {
								if (ex_id = ex.attr('id')) {
									ex_no = ex_id.substring(ex_id.lastIndexOf("_")+1);
									if (nw_no <= ex_no) break;
								}
								ex1 = ex;
								ex = reverse_order ? ex.next() : ex.prev();
								ex1.slideUp(function () { $(this).remove() });
							}
							if (nw_no == ex_no) {
								if (nw.attr("hash") != ex.attr("hash"))
									ex.html(nw.html());
								ex = reverse_order ? ex.next() : ex.prev();
							} else {
								if (ex.length == 0) {
									if (reverse_order) {
										messages.append(nw[0].outerHTML);
									} else {
										messages.prepend(nw.hide()[0].outerHTML).children().first().slideDown();
									}
									new_stuff = true;
								} else {
									if (reverse_order) {
										ex.before(nw[0].outerHTML);
									} else {
										ex.after(nw[0].outerHTML);
									}
								}
								lightbox_support('div#sb_messages #sb_message_' + nw_no + ' .sb_message_body > a > img');
								split_menu(nw_no);
							}
						}
						nw = nw.prev();
					}
					while (ex.length > 0) {
						ex1 = ex;
						ex = reverse_order ? ex.next() : ex.prev();
						if (ex1.attr("id") || nw_id) ex1.slideUp(function () { $(this).remove() });
					}
					placeholder.remove();
	
					var speaker = $('.icons .speaker', widget)
					if (new_stuff && $('.icons .speaker', widget).hasClass('active'))
						$("audio#notify", widget)[0].play();
					if (reverse_order) {
						if (messages.hasClass('empty') || (new_stuff && scrollBottom == 0))
							setTimeout(function() {messages.animate({scrollTop: messages[0].scrollHeight}, "slow", function () {doNotUpdateLock = false;});}, 1000);
						else if (messages[0].scrollTop != messages[0].scrollHeight - messages[0].offsetHeight - scrollBottom)
							messages[0].scrollTop = messages[0].scrollHeight - messages[0].offsetHeight - scrollBottom;
					}
					if (messages.hasClass('empty'))
						messages.removeClass('empty');
				}
				$(".icons .spinner", widget).fadeOut("slow");
			},
			complete: function() {
				$(widget).data("msgAddLock", 0);
				reloadInProgress = false;
			}
		});
	}

	$('body').on('click', '.sb_message_header .menu .delete', function (event) {
		event.preventDefault();
		var widget      = $(this).parents(".Ajax_Shoutbox_Widget"),
				message     = $(this).parents(".sb_message"),
				message_id  = message.attr('id'),
				message_num = message_id.substring(message_id.lastIndexOf("_")+1);

		if (!confirm(SimpleAjaxShoutbox.delete_message_text)) return false;
		$.ajax({
			url: SimpleAjaxShoutbox.ajaxurl,
			type: "POST",
			cache: false,
			data: {
				'action':      'shoutbox_delete_message',
				'm_id':        message_num,
				'_ajax_nonce': $("data#nonce", widget).attr("value")
			},
			success: function (a, b) {
				if (parseInt(a) > 0)
					$('div#sb_message_' + a, widget).slideUp('slow', function() { $(this).remove(); });
				$('#sb_message', widget).val('');
			}
		})
	});

	function lightbox_support(selector) {
		if (selector === undefined) selector = ".sb_message_body > a > img";
		try {
			if (typeof($.fn.lightbox) == "function")
				$(selector).parent().attr("rel", "lightbox").lightbox({title: function(){return $(this).children().attr("alt")}});
			else if ($.colorbox)
				$(selector).parent().colorbox({title: function(){return $(this).children().attr("alt")},
																												 maxWidth: "100%",
																												 maxHeight: $(window).height() - 2 * ($('#wpadminbar').height() || 0)});
			else if (typeof($.fn.fancybox) == "function")
				$(selector).parent().fancybox({title: function(){return $(this).children().attr("alt")}});
			else if (typeof Shadowbox !== 'undefined')
				Shadowbox.setup($(selector).parent().get(), []);
			else if (typeof(doLightBox) == "function") {
				$(selector).parent().attr("rel", "lightbox");
				doLightBox();
			}
		} catch (err) {}
	}

	lightbox_support();

	/*
	// does not work, as the top page protocol is http and iframe protocol is https, protocols must match
	$(".sb_message_body iframe.instagram-embed").load(function () {
		this.style.height = this.contentWindow.document.body.offsetHeight + 'px';
	});
	*/

	var intervalID = 0,
			widgetID,
			reloadTime;

	/* for each chat widget -- well, there should be just one... */
	$(".Ajax_Shoutbox_Widget").each(function (index) {
		var widget_id = $(this).data("lock", 0)
													 .data("msgAddLock", 0)
													 .data("msgTotal", SimpleAjaxShoutbox.max_messages)
													 .attr("id");
		widgetID = widget_id;
		reloadTime = parseInt(SimpleAjaxShoutbox.reload_time) * 1000;

		/* set reload interval */
		intervalID = setInterval(function () {
			sb_reload(widgetID);
		}, reloadTime);

		/* when user clicks smiley, append it to the text in input area */
		$("#sb_smiles .wp-smiley", this).click(function (index) {
			var input = $(this).parents(".Ajax_Shoutbox_Widget").find("#sb_form #sb_message")[0];
			insertAtCursor(input, $(this).attr("title"));
			input.focus();
		});

		/* when user scrolls to the bottom (or top with reverse order), add more messages */
		$("div#sb_messages", this).scroll(function () {
			var m = $(this);
			if (doNotUpdateLock || (m.hasClass("reverse-order") && m.hasClass("empty"))) return;
			var widget = $("#" + widget_id);
			var lock = m.hasClass('reverse-order') ? m[0].scrollHeight - m.scrollTop() > m.outerHeight() : m.scrollTop() > 5;
			widget.data("lock", lock);
			$(".icons .lock", widget).toggle(lock);
			if (!widget.data("msgAddLock") && (m.hasClass('reverse-order') ? m.scrollTop() == 0 : m[0].scrollHeight - m.scrollTop() <= m.outerHeight())) {
				widget.data("msgAddLock", 1)
							.data("msgTotal", parseInt(widget.data("msgTotal")) + parseInt(SimpleAjaxShoutbox.max_messages));
				sb_reload(widget_id, true);
			}
		});

		/* function for user adding new message */
		function add_message(event) {
			reloadInProgress = false;
			if (event) event.preventDefault();
			var widget = $("#" + widget_id);

			/* check if max message length not exceeded */
			var maxMsgLen = parseInt(SimpleAjaxShoutbox.max_msglen);
			if ($("#sb_message", widget).val().length > maxMsgLen ) {
				var err = SimpleAjaxShoutbox.max_msglen_error_text.replace("%length%", $("#sb_message").val().length).replace("%maxlength%", maxMsgLen);
				alert(err);
				return;
			}

			/* if browser does not support HTML5 placeholder, reset "empty" fields */
			if (!browserSupportsPlaceholder) {
				widget.parents('form').find('[placeholder]').each(function () {
					var input = $(this);
					if (input.val() == input.attr('placeholder')) {
						input.val('');
					}
				});
			};

			/* read field values */
			var b = $("input#sb_name", widget).val();
			var c = $("input#sb_website", widget).val();
			var d = $("#sb_message", widget).val();

			/* if user name not filled in, error */
			if (b == '') {
				alert(SimpleAjaxShoutbox.name_empty_error_text);
				if (!browserSupportsPlaceholder) {
					$('#sb_form [placeholder]', widget).blur();
				}
				return;
			}

			/* if message text not filled, error */
			if (d == '') {
				alert(SimpleAjaxShoutbox.msg_empty_error_text);
				if (!browserSupportsPlaceholder) {
					$('#sb_form [placeholder]', widget).blur();
				}
				return;
			}

			$("#sb_form .spinner", widget).css("display", "inline-block");
			$("#sb_addmessage", widget).addClass("disabled");

			/* send message add through ajax to server */
			var widget_num = widget_id.substring(widget_id.lastIndexOf("-")+1);
			$.ajax({
				url: SimpleAjaxShoutbox.ajaxurl,
				type: "POST",
				cache: false,
				data: {
					'action'  : 'shoutbox_add_message',
					'user'    : b,
					'message' : d,
					'website' : c,
					'id'      : widget_num
				},
				success: function (a) {
					var match = a.match(/sb_message_(\d+)/);
					if ($("div#sb_messages #sb_message_" + match[1], widget).length == 0) {
						var messages = $("div#sb_messages", widget);
						var no_messages = $("div.no-messages", messages);
						if (no_messages.length)
							no_messages.remove();
						if (messages.hasClass("reverse-order")) {
							var scrollBottom = messages[0].scrollHeight - messages[0].scrollTop - messages[0].offsetHeight;
							messages.append(a);
							if (scrollBottom == 0) {
								doNotUpdateLock = true;
								messages.animate({scrollTop: messages[0].scrollHeight}, "fast", function() {doNotUpdateLock=false;});
							}
						} else {
							a = a.replace('id="sb_message_', 'style="display:none" id="sb_message_');
							messages.prepend(a);
							$("#sb_message_" + match[1], messages).slideDown();
						}
						lightbox_support('#sb_message_' + match[1] + ' .sb_message_body > a > img');
						split_menu(match[1]);
					}
					$("#sb_message", widget).val("");
					if (!browserSupportsPlaceholder) $('#sb_form [placeholder]', widget).blur();
					$("#sb_form .spinner", widget).hide();
					$("#sb_form .confirm", widget).css("display", "inline-block").fadeOut("slow");
				},
				error: function (a) {
					// report error in a new way, this does not work anymore
					// $("span#sb_status", widget).html(SimpleAjaxShoutbox.request_error_text)
					$("#sb_form .spinner", widget).hide();
				},
				complete: function() {
					$("#sb_addmessage", widget).removeClass("disabled");
				}
			})
		}


		$("#sb_addmessage", this).click(add_message);
		$("#sb_message", this).keydown(function(e) {
			if ((e.keyCode == 10 || e.keyCode == 13) && e.ctrlKey) add_message();  // Ctrl-Enter sends the message
		});

		sb_reload(widget_id);
	});

	/* show the input area on mouseover */
	$("div#sb_messages").mouseover(function () {
		$("span#sb_status").html("")
	});

	/* show smilies on click */
	$("#sb_showsmiles").click(function () {
		$("div#sb_smiles").fadeIn("slow")
	});

	$('.Ajax_Shoutbox_Widget .icons .speaker').click(function () {
		document.cookie = 'shoutbox_speaker=' + ($(this).toggleClass("active").hasClass("active") ? "true" : "false") + "; expires=Fri, 31 Dec 9999 23:59:59 GMT; path=/"
	});

	/* add placeholder support via jQuery to browsers, that don't natively support it through HTML5 */
	if (!browserSupportsPlaceholder) {
		$('#sb_form [placeholder]').focus(function () {
			var input = $(this);
			if (input.val() == input.attr('placeholder')) {
				input.val('');
				input.removeClass('sb_placeholder');
			}
		}).blur(function () {
			var input = $(this);
			if (input.val() == '' || input.val() == input.attr('placeholder')) {
				input.addClass('sb_placeholder');
				input.val(input.attr('placeholder'));
			}
		}).blur();
		$('#sb_form [placeholder]').parents('form').submit(function () {
			$(this).find('[placeholder]').each(function () {
				var input = $(this);
				if (input.val() == input.attr('placeholder')) {
					input.val('');
				}
			})
		});
	}

	$('body').on('click', '.sb_message_body .youtube-embed-video .play-button', function (event) {
		embedded_video(event, this, "youtube", "https://www.youtube.com/embed/", "YouTube");
	});

	$('body').on('click', '.sb_message_body .vidme-embed-video .play-button', function (event) {
		embedded_video(event, this, "vidme", "https://vid.me/e/", "vid.me");
	});

	$('body').on('click', '.sb_message_body .vimeo-embed-video .play-button', function (event) {
		embedded_video(event, this, "vimeo", "https://player.vimeo.com/video/", "vimeo");
	});

	function embedded_video(event, that, provider, urlbase, windowCaption) {
		event.preventDefault();
		var url = urlbase + $(that).attr("rel") + "?autoplay=1";
		var width = $(window).width(),
				height = $(window).height(),
				ratio = 16 / 9,
				fill = 0.9;
		if (width >= 640) {
			if (width / ratio > height) {
				width = fill * width;
				height = width / ratio;
			} else {
				height = fill * height;
				width = height * ratio;
			}
		} else
			height = width / ratio;

//  if (typeof($.fn.lightbox) == "function") {
//    plugin WP Lightbox 2 does not support lightboxing of videos
//  } else
		if ($.colorbox)
			$.colorbox({width:   width + 44,
									height:  height + 70,
									iframe:  true,
									href:    url
								 });
		else if (typeof($.fn.fancybox) == "function")
			$(that).addClass("iframe").attr("href", url).fancybox().click();
		else if (typeof Shadowbox !== 'undefined')
			Shadowbox.open({content:    url,
											type:       "iframe",
											player:     "iframe",
											width:      width,
											height:     height
										 });
		else if ($(that).parents("." + provider + "-embed-video").width() < 320)
			window.open(url, windowCaption, 'width=640,height=360'); // narrow chatbox, open video in popup
		else
			$(that).parents("." + provider + "-embed-video").replaceWith('<iframe width="100%" height="' + $(that).parents("." + provider + "-embed-video").width() * 360 / 640 + '" src="' + url + '"></iframe>'); // wide chatbox, play inline

	}

	// browser tab visibility:

	var hidden = "hidden";

	if (hidden in document)
		document.addEventListener("visibilitychange", onvischange);
	else if ((hidden = "mozHidden") in document)
		document.addEventListener("mozvisibilitychange", onvischange);
	else if ((hidden = "webkitHidden") in document)
		document.addEventListener("webkitvisibilitychange", onvischange);
	else if ((hidden = "msHidden") in document)
		document.addEventListener("msvisibilitychange", onvischange);
	// IE 9 and lower:
	else if ("onfocusin" in document)
		document.onfocusin = document.onfocusout = onvischange;
	// All others:
	else
		window.onpageshow = window.onpagehide
		= window.onfocus = window.onblur = onvischange;

	function onvischange (evt) {
		var v = "visible", h = "hidden",
				evtMap = {
					focus:v, focusin:v, pageshow:v, blur:h, focusout:h, pagehide:h
				};

		evt = evt || window.event;
		var vis;
		if (evt.type in evtMap)
			vis = evtMap[evt.type];
		else
			vis = this[hidden] ? "hidden" : "visible";

		if (vis == "hidden") {
			active = false;
		} else {
			active = true;
			if (!intervalID) {
				intervalID = setInterval(function () {
					sb_reload(widgetID);
				}, reloadTime);
				sb_reload(widgetID);
			}
		}
	}

	// set the initial state (but only if browser supports the Page Visibility API)
	if( document[hidden] !== undefined )
		onvischange({type: document[hidden] ? "blur" : "focus"});

	function insertAtCursor(myField, myValue) {
		//IE support
		if (document.selection) {
			myField.focus();
			sel = document.selection.createRange();
			sel.text = myValue;
		}
		//MOZILLA and others
		else if (myField.selectionStart || myField.selectionStart == '0') {
			var startPos = myField.selectionStart;
			var endPos = myField.selectionEnd;
			myField.value = myField.value.substring(0, startPos)
				+ myValue
				+ myField.value.substring(endPos, myField.value.length);
		} else {
			myField.value += myValue;
		}
	}

	function split_menu(message_id) {
		var query = '.sb_message_header .menu';
		if (message_id)
			query = '#sb_message_' + message_id + ' ' + query;
		$(query).each(function() {
			$(this).append('<span class="commands"></span><span class="infos"></span>');
			$(this).find('.command').appendTo($(this).find('.commands'));
			$(this).find('.info').appendTo($(this).find('.infos'));
		});
	}
	split_menu();

	$('body').on('click', '.sb_message_header .menu .reply', function (event) {
		event.preventDefault();
		var id = $(this).parents(".sb_message").attr("id").substring(11);
		var user = $(this).parents(".sb_message").find(".username").text();
		var reply = "{reply " + id + "} ";
		var input = $(this).parents(".Ajax_Shoutbox_Widget").find("#sb_form #sb_message")[0];
		insertAtCursor(input, reply);
		input.focus();
	});

	$('body').append('<div id="sb-reply">Reply</div>');

	var reply_visible = false;
	var reply_hide_timeout = 0;

	function hide_reply() {
		reply_visible = false;
		reply_hide_timeout = 0;
		$('#sb-reply').hide();
	}

	$('body').on('mouseenter', '.sb_message_body .reply', function (event) {
		if (reply_hide_timeout) {
			clearTimeout(reply_hide_timeout);
			reply_hide_timeout = 0;
		}

		var widget     = $(this).parents(".Ajax_Shoutbox_Widget"),
				widget_id  = widget.attr('id'),
				widget_num = widget_id.substring(widget_id.lastIndexOf("-")+1);

		var top   = $(this).offset().top + $(this).height(),
				left  = $(this).parents(".sb_message_body").offset().left,
				width = $(this).parents(".sb_message_body").width();

		var m_id = $(this).attr("rel"),
				orig_msg = widget.find("#sb_message_" + m_id);

		reply_visible = true;
		if ($('#sb-reply').attr("rel") == m_id) {
			$('#sb-reply').css("top", top)
										.css("left", left)
										.css("width", width)
										.show();

		} else if (orig_msg.length > 0) {
			$('#sb-reply').html(orig_msg.html())
										.attr("rel", m_id)
										.css("top", top)
										.css("left", left)
										.css("width", width)
										.show();

		} else {
			$.ajax({
				url: SimpleAjaxShoutbox.ajaxurl,
				type: "POST",
				cache: false,
				data: {
					'action':      'shoutbox_single',
					'm_id':        m_id,
					'id'    :      widget_num
				},
				beforeSend: function() {
					$(".icons .spinner", widget).css("display", "inline-block");
				},
				success: function (a, b) {
					if (a != "") {
						$('#sb-reply').html(a)
													.attr("rel", m_id)
													.css("top", top)
													.css("left", left)
													.css("width", width);
					}
					if (reply_visible)
						$('#sb-reply').show();
				},
				complete: function() {
					$(".icons .spinner", widget).fadeOut("slow");
				}
			});
		}
	}).on('mouseleave', '.sb_message_body .reply', function (event) {
		reply_hide_timeout = setTimeout(function(){hide_reply();}, 100);
	});

	$('body').on('mouseenter', '#sb-reply', function (event) {
		if (reply_hide_timeout) {
			clearTimeout(reply_hide_timeout);
			reply_hide_timeout = 0;
		}
	}).on('mouseleave', '#sb-reply', function (event) {
		hide_reply();
	});
	
	$("#sb_form .resizable").resizable({
		handles: 's',
		minHeight: 36,
		stop: function(event, ui) {
			var $this = $(this);
			var em_height = (this.offsetHeight / parseFloat($this.css("font-size"))) + "em";
			$this.css("height", em_height);
			document.cookie = $this.parents('.Ajax_Shoutbox_Widget').attr('id') + '_input_height=' + em_height + "; expires=Fri, 31 Dec 9999 23:59:59 GMT; path=/"
		}
	});
});