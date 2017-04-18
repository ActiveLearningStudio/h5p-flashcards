var H5P = H5P || {};

/**
 * Flashcards module.
 *
 * @param {jQuery} $
 */
H5P.Flashcards = (function ($) {

  /**
   * Initialize module.
   *
   * @param {Object} options Run parameters
   * @param {Number} id Content identification
   */
  function C(options, id) {
    H5P.EventDispatcher.call(this);
    this.answers = [];
    this.numAnswered = 0;
    this.contentId = this.id = id;
    this.options = $.extend({}, {
      description: "What does the card mean?",
      progressText: "Card @card of @total",
      next: "Next",
      previous: "Previous",
      checkAnswerText: "Check answer",
      showSolutionsRequiresInput: true,
      defaultAnswerText: "Your answer",
      correctAnswerText: "Correct",
      incorrectAnswerText: "Incorrect",
      showSolutionText: "Correct answer",
      informationText: "Information"
    }, options);
    this.$images = [];

    this.on('resize', this.resize, this);
  }

  C.prototype = Object.create(H5P.EventDispatcher.prototype);
  C.prototype.constructor = C;

  /**
   * Append field to wrapper.
   *
   * @param {jQuery} $container
   */
  C.prototype.attach = function ($container) {
    var that = this;

    this.$container = $container
      .addClass('h5p-flashcards')
      .attr('title', this.options.description)
      .html('<div class="h5p-loading">Loading, please wait...</div>');

    // Load card images. (we need their size before we can create the task)
    var loaded = 0;
    for (var i = 0; i < this.options.cards.length; i++) {
      var card = this.options.cards[i];
      var load = function () {
        loaded++;
        if (loaded === that.options.cards.length) {
          that.cardsLoaded();
        }
      };
      if (card.image !== undefined) {
        var $image = $('<img class="h5p-clue" src="' + H5P.getPath(card.image.path, this.id) + '"/>').load(load);
        this.$images[i] = $image;
      }
      else {
        this.$images[i] = $('<div class="h5p-clue"></div>');
      }
      if (card.image === undefined || $image.get().complete) {
        // Image cached
        load();
      }
    }
  };

  /**
   * Cleans the user input string
   *
   * @param str The user input
   * @returns {string}
   */
  function cleanUserInput (str){
    str = str || '';

    return str.trim()
      .toLowerCase()
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /**
   * Trims a String
   *
   * @param {string} str A string to trim
   * @returns {string} The trimmed string
   */
  function trimString (str){
    return str.trim();
  }

  /**
   * Checks if the user anwer matches an answer on the card
   * @private
   *
   * @param card The card
   * @param userAnswer The user input
   * @return {Boolean} If the answer is found on the card
   */
  function isCorrectAnswer (card, userAnswer){
    var answerStr = card.answer || '';
    var answer = answerStr.toLowerCase();
    return answer === userAnswer;
  }

  C.prototype.getScore = function (){
    var that = this;

    return that.options.cards.reduce(function (sum, card, i) {
      return sum + (isCorrectAnswer(card, that.answers[i]) ? 1 : 0);
    }, 0);
  };

  C.prototype.getMaxScore = function (){
    return this.options.cards.length;
  };

  /**
   * Called when all cards has been loaded.
   */
  C.prototype.cardsLoaded = function () {
    var that = this;
    var $inner = this.$container.html(
      '<div class="h5p-description">' + this.options.description + '</div>' +
      '<div class="h5p-progress"></div>' +
      '<div class="h5p-inner" role="list"></div>' +
      '<div class="h5p-navigation">' +
        '<button type="button" class="h5p-button h5p-previous h5p-hidden" tabindex="0" title="' + this.options.previous + '"></button>' +
        '<button type="button" class="h5p-button h5p-next" tabindex="0" title="' + this.options.next + '"></button>'
    )
      .children('.h5p-inner');

    // Create visual progress and add accessibility attributes
    this.$visualProgress = $('<div/>', {
      'class': 'h5p-visual-progress',
      'role': 'progressbar',
      'aria-valuemax': '100',
      'aria-valuemin': (100 / this.options.cards.length).toFixed(2)
    })
      .append($('<div/>', {
        'class': 'h5p-visual-progress-inner'
      }))
      .appendTo(this.$container);

    this.$progress = this.$container.find('.h5p-progress');

    // Add cards
    for (var i = 0; i < this.options.cards.length; i++) {
      this.addCard(i, $inner);
    }

    // Find highest image and set task height.
    var height = 180;
    for (var i = 0; i < this.$images.length; i++) {
      var $image = this.$images[i];

      if ($image === undefined) {
        continue;
      }

      var imageHeight = $image.height();
      if (imageHeight > height) {
        height = imageHeight;
      }
    }

    // Center images
    for (var i = 0; i < this.$images.length; i++) {
      var $image = this.$images[i];
      if ($image === undefined) {
        continue;
      }
    }

    // Active buttons
    var $buttonWrapper = $inner.next();
    this.$nextButton = $buttonWrapper.children('.h5p-next').click(function () {
      that.next();
    });
    this.$prevButton = $buttonWrapper.children('.h5p-previous').click(function () {
      that.previous();
    });

    if (this.options.cards.length < 2) {
      this.$nextButton.hide();
    }

    this.$current.next().addClass('h5p-next');

    $inner.initialImageContainerWidth = $inner.find('.h5p-imageholder').outerWidth();

    this.$inner = $inner;
    this.setProgress();
    this.trigger('resize');
  };

  C.prototype.addCard = function (index, $inner) {
    var that = this;
    var card = this.options.cards[index];
    var imageText = '<div class="h5p-imagetext">' + (card.text !== undefined ? card.text : '') + '</div>';

    var $card = $('<div role="listitem" class="h5p-card h5p-animate' + (index === 0 ? ' h5p-current' : '') + '"> ' +
      '<div class="h5p-cardholder">' +
      '<div class="h5p-imageholder"><div class="h5p-flashcard-overlay"></div></div>' +
      '<div class="h5p-foot">' + imageText + '<div class="h5p-answer">' +
      '<div class="h5p-input"><input type="text" class="h5p-textinput" tabindex="-1" placeholder="' + this.options.defaultAnswerText + '"/>' +
      '<button type="button" class="h5p-button" tabindex="-1">' + this.options.checkAnswerText + '</button></div></div></div></div></div>')
      .appendTo($inner);
    $card.find('.h5p-imageholder').prepend(this.$images[index]);

    $card.prepend($('<div class="h5p-flashcard-overlay"></div>').on('click', function () {
      if ($(this).parent().hasClass('h5p-previous')) {
        that.previous();
      } else {
        that.next();
      }
    }));

    // Add tip if tip exists
    if (card.tip !== undefined && card.tip.trim().length > 0) {
      $('.h5p-input', $card).append(H5P.JoubelUI.createTip(card.tip).attr({'tabindex': '-1', 'title': this.options.informationText})).addClass('has-tip');
    }

    var $input = $card.find('.h5p-textinput');

    $input.change(function (){
      that.answers[index] = cleanUserInput($input.val());
      that.triggerXAPI('interacted');
    });

    var $button = $card.find('.h5p-button').click(function () {
      var card = that.options.cards[index];
      var userAnswer = cleanUserInput($input.val());
      var userCorrect = isCorrectAnswer(card, userAnswer);

      if (userAnswer == '') {
        $input.focus();
      }

      if (!that.options.showSolutionsRequiresInput || userAnswer !== '' || userCorrect) {
        that.numAnswered++;
        $input.add(this).attr('disabled', true);

        if (userCorrect) {
          $input.parent()
            .addClass('h5p-correct')
            .append('<div class="h5p-feedback-label" tabindex="0" aria-label="' + that.options.correctAnswerText + '">' + that.options.correctAnswerText + '!</div>');
          $card.addClass('h5p-correct');

          var $solution = $('<div class="h5p-solution">' +
            '<span class="solution-icon h5p-rotate-in"></span>' +
          '</div>').appendTo($card.find('.h5p-imageholder'));
        }
        else {
          $input.parent()
            .addClass('h5p-wrong')
            .append('<span class="h5p-feedback-label" tabindex="0" aria-label="' + that.options.incorrectAnswerText + '">' + that.options.incorrectAnswerText + '!</span>');
          $card.addClass('h5p-wrong');

          var $solution = $('<div class="h5p-solution">' +
            '<span class="solution-icon h5p-rotate-in"></span>' +
            '<span class="solution-text">' + (that.options.cards[index].answer ? that.options.showSolutionText + ': <span>' + that.options.cards[index].answer + '</span>' : '') + '</span>' +
          '</div>').appendTo($card.find('.h5p-imageholder'));
        }

        $input.siblings('.h5p-feedback-label').focus();

        that.nextTimer = setTimeout(function () {
          that.next();
        }, 2000);
      }

      if (that.numAnswered >= that.options.cards.length) {
        that.triggerXAPICompleted(that.getScore(), that.getMaxScore());
      }
    });

    $card.find('.h5p-textinput').keypress(function (event) {
      if (event.keyCode === 13) {
        $button.click();
        return false;
      }
    });

    if (index === 0) {
      this.setCurrent($card);
    }
  };

  C.prototype.setProgress = function () {
    var index = this.$current.index();
    this.$progress.text((index + 1) + ' / ' + this.options.cards.length);
    this.$visualProgress
      .attr('aria-valuenow', ((index + 1) / this.options.cards.length * 100).toFixed(2))
      .find('.h5p-visual-progress-inner').width((index + 1) / this.options.cards.length * 100 + '%');
  };

  /**
   * Set card as current card.
   *
   * Adjusts classes and tabindexes for existing current card and new
   * card.
   *
   * @param {jQuery-object} $card
   * @param {string} newClassForOldCurrentCard
   *   Class to add to existing current card.
   */
  C.prototype.setCurrent = function ($card, newClassForOldCurrentCard) {
    // Remove from existing card.
    if (this.$current) {
      this.$current.find('.h5p-textinput').attr('tabindex', '-1');
      this.$current.find('.joubel-tip-container').attr('tabindex', '-1');
      this.$current.find('.h5p-button').attr('tabindex', '-1');
    }

    // Set new card
    this.$current = $card;

    // Update card classes
    $card.removeClass('h5p-previous h5p-next');
    $card.addClass('h5p-current');

    $card.siblings().removeClass('h5p-current h5p-previous h5p-next');

    $card.prev().addClass('h5p-previous');
    $card.next().addClass('h5p-next');

    // Update tab indexes
    $card.find('.h5p-textinput').attr('tabindex', '0');
    $card.find('.h5p-button').attr('tabindex', '0');
    $card.find('.joubel-tip-container').attr('tabindex', '0');
  };

  /**
   * Display next card.
   */
  C.prototype.next = function () {
    var that = this;
    var $next = this.$current.next();

    clearTimeout(this.nextTimer);

    if (!$next.length) {
      return;
    }

    setTimeout(function () {
      that.setCurrent($next);
      if (!that.$current.next().length) {
        that.$nextButton.addClass('h5p-hidden');
      }
      that.$prevButton.removeClass('h5p-hidden');
      that.setProgress();
    }, 10);

    setTimeout(function () {
      $next.find('.h5p-textinput').focus();
    }, 500);

  };

  /**
   * Display previous card.
   */
  C.prototype.previous = function () {
    var that = this;
    var $prev = this.$current.prev();

    clearTimeout(this.nextTimer);

    if (!$prev.length) {
      return;
    }

    $prev.find('.h5p-textinput').focus();

    setTimeout(function () {
      that.setCurrent($prev);

      if (!that.$current.prev().length) {
        that.$prevButton.addClass('h5p-hidden');
      }
      that.$nextButton.removeClass('h5p-hidden');
      that.setProgress();
    }, 10);
  };

  /**
   * Gather copyright information from cards.
   *
   * @returns {H5P.ContentCopyrights}
   */
  C.prototype.getCopyrights = function () {
    var info = new H5P.ContentCopyrights();

    // Go through cards
    for (var i = 0; i < this.options.cards.length; i++) {
      var image = this.options.cards[i].image;
      if (image !== undefined && image.copyright !== undefined) {
        var rights = new H5P.MediaCopyright(image.copyright);
        rights.setThumbnail(new H5P.Thumbnail(H5P.getPath(image.path, this.id), image.width, image.height));
        info.addMedia(rights);
      }
    }

    return info;
  };

  /**
   * Update the dimensions and imagesizes of the task.
   */
  C.prototype.resize = function () {
    var self = this;
    if (self.$inner === undefined) {
      return;
    }
    var maxHeight = 0;
    var maxHeightImage = 0;
    var imageHolderWidth = self.$inner.find('.h5p-imageholder').width();
    var minPadding = parseFloat(self.$inner.css('font-size'));

    if (this.$inner.width() / parseFloat($("body").css("font-size")) <= 31) {
      self.$inner.addClass('h5p-mobile');
    }
    else {
      self.$inner.removeClass('h5p-mobile');
    }

    //Resize all images and find max height.
    self.$images.forEach(function (image) {
      var $image = image;
      var imageHeight = 0;
      $image.css({
        'height': 'initial',
        'width': 'initial'
      });

      //Resize image if it is too big.
      if (($image[0].naturalWidth + (minPadding * 2)) > imageHolderWidth ||
        ($image[0].naturalHeight + (minPadding * 2)) > imageHolderWidth) {
        var ratio = $image[0].naturalHeight / $image[0].naturalWidth;

        //Landscape image
        if( $image[0].naturalWidth >= $image[0].naturalHeight) {
          $image.css({
            'width': imageHolderWidth - (minPadding * 2),
            'height': 'auto'
          });
          imageHeight = (imageHolderWidth - (minPadding * 2)) * ratio;
        }
        //Portrait image
        else {
          $image.css({
            'height': imageHolderWidth - minPadding * 2,
            'width': 'auto'
          });
          imageHeight = imageHolderWidth - minPadding * 2;
        }
      }
      //Else use source dimensions
      else {
        $image.css({
          'height': 'initial',
          'width': 'initial'
        });
        imageHeight = $image.outerHeight();
      }
      //Keep max height
      maxHeightImage = imageHeight + minPadding * 2 > maxHeightImage ? imageHeight + minPadding * 2 : maxHeightImage;
    });

    //Find container dimensions needed to encapsule image and text.
    self.$inner.children().each( function (cardWrapper) {
      var cardholderHeight = maxHeightImage + $(this).find('.h5p-foot').outerHeight();
      maxHeight = cardholderHeight > maxHeight ? cardholderHeight : maxHeight;
    });

    //Resize cards holder
    var innerHeight = 0;
    this.$inner.children().each(function() {
      if ($(this).height() > innerHeight) {
        innerHeight = $(this).height();
      }
    });

    this.$inner.height(innerHeight);
  };

  return C;
})(H5P.jQuery);
