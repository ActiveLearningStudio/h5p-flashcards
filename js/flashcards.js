var H5P = H5P || {};

if (H5P.getPath === undefined) {
  /**
   * Find the path to the content files based on the id of the content
   *
   * Also identifies and returns absolute paths
   *
   * @param {String} path Absolute path to a file, or relative path to a file in the content folder
   * @param {Number} contentId Identifier of the content requesting the path
   * @returns {String} The path to use.
   */
  H5P.getPath = function (path, contentId) {
    if (path.substr(0, 7) === 'http://' || path.substr(0, 8) === 'https://') {
      return path;
    }

    return H5PIntegration.getContentPath(contentId) + path;
  };
}

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
    this.id = id;
    this.options = $.extend({}, {
      description: "What does the card mean?",
      progressText: "Card @card of @total",
      next: "Next",
      previous: "Previous",
      checkAnswerText: "Check answer"
    }, options);

    this.$images = [];
  };

  /**
   * Append field to wrapper.
   *
   * @param {jQuery} $container
   */
  C.prototype.attach = function ($container) {
    var that = this;

    this.$container = $container.addClass('h5p-flashcards').html('<div class="h5p-loading">Loading, please wait...</div>');

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
   * Called when all cards has been loaded.
   */
  C.prototype.cardsLoaded = function () {
    var that = this;
    var $inner = this.$container.html('<div class="h5p-description">' + this.options.description + '</div><div class="h5p-inner"></div><div class="h5p-navigation"><button class="h5p-button h5p-previous h5p-hidden" tabindex="3">' + this.options.previous + '</button><button class="h5p-button h5p-next" tabindex="4">' + this.options.next + '</button><div class="h5p-progress"></div>').children('.h5p-inner');
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

    // Set height
    $inner.css('height', height + 286); // TODO: Avoid magic numbers

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
    
    this.setProgress();
  };

  C.prototype.addCard = function (index, $inner) {
    var that = this;

    var card = this.options.cards[index];
    var imageText = (card.text !== undefined ? '<div class="h5p-imagetext">' + card.text + '</div>' : '');
    var $card = $('<div class="h5p-card h5p-animate' + (index === 0 ? ' h5p-current' : '') + '"><div class="h5p-foot">' + imageText + '<div class="h5p-answer"><div class="h5p-input"><input type="text" class="h5p-textinput" tabindex="-1"/><button class="h5p-button" tabindex="-1">' + this.options.checkAnswerText + '</button></div></div></div></div>').appendTo($inner);
    $card.prepend(this.$images[index]);

    var $button = $card.find('.h5p-button').click(function () {
      var $input = $card.find('.h5p-textinput');
      $input.add(this).attr('disabled', true);

      var correct = that.options.cards[index].answer.toLowerCase().split('/');
      var userAnswer = H5P.trim($input.val()).toLowerCase();
      var userCorrect = false;
      for (var i = 0; i < correct.length; i++) {
        if (H5P.trim(correct[i]) === userAnswer) {
          userCorrect = true;
          break;
        }
      }

      if (userCorrect) {
        $input.parent().addClass('h5p-correct');
      }
      else {
        $input.parent().addClass('h5p-wrong');
      }
      
      that.$images[index].addClass('h5p-collapse');
      setTimeout(function () {
        that.$images[index].removeClass('h5p-collapse');
      }, 150);

      var $solution = $('<div class="h5p-solution h5p-hidden" style="top:' + (Math.floor(that.$images[index].outerHeight() / 2) + 4) + 'px"><span>' + that.options.cards[index].answer + '</span></div>').appendTo($card);
      setTimeout(function () {
        $solution.removeClass('h5p-hidden');
      }, 150);
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
    this.$progress.text(this.options.progressText.replace('@card', index + 1).replace('@total', this.options.cards.length));
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
      this.$current.removeClass('h5p-current');
      this.$current.find('input, button').attr('tabindex', '-1');
      if (newClassForOldCurrentCard) {
        this.$current.addClass(newClassForOldCurrentCard);
      }
    }

    this.$current = $card;
    $card.addClass('h5p-current');
    $card.find('.h5p-textinput').attr('tabindex', '1');
    $card.find('.h5p-button').attr('tabindex', '2');
    $card.removeClass('h5p-previous');
  }

  /**
   * Display next card.
   */
  C.prototype.next = function () {
    var that = this;
    var $next = this.$current.next();
    if (!$next.length) {
      return;
    }

    setTimeout(function () {
      that.setCurrent($next, 'h5p-previous');

      if (!that.$current.next().length) {
        that.$nextButton.addClass('h5p-hidden');
      }
      that.$prevButton.removeClass('h5p-hidden');
      that.setProgress();
    }, 10);
  };

  /**
   * Display previous card.
   */
  C.prototype.previous = function () {
    var that = this;
    var $prev = this.$current.prev();
    if (!$prev.length) {
      return;
    }

    setTimeout(function () {
      that.setCurrent($prev);

      if (!that.$current.prev().length) {
        that.$prevButton.addClass('h5p-hidden');
      }
      that.$nextButton.removeClass('h5p-hidden');
      that.setProgress();
    }, 10);
  };

  return C;
})(H5P.jQuery);