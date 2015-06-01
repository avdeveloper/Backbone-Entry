/**
 * View for a single entry
 */
var EntryView = Backbone.View.extend({
    tagName: 'li',

    template: _.template(document.getElementById('entry-tpl').innerHTML),

    // model attributes that would trigger a render of the entire entry
    whitelistedAttributes: [ 'userResponse' ],

    className: 'entry', // initial only, access className at: this.el.className

    initialize: function (options) {
        this.render();

        this.model.on('change:name', this._changeName, this);
        this.model.on('change:status', this._changeStatusClassName, this);
        this.model.on('change:status_color', this._changeStatusColor, this);
        this.model.on('change:phone', this._changePhone, this);
        this.model.on('change:has_profile', this._toggleProfileClassName, this);
        this.model.on('change:userResponse', this._toggleResponseClassName, this);
        this.model.on('change:checkedin_at', this._toggleSeatEntryClassName, this);
        this.model.on('change:hasPhone', this._toggleHasPhoneClassName, this);
        this.model.on('change:quotedTimeText', this._changeQuotedTimeText, this);
        this.model.on('change:minWaiting', this._changeWaitingTime, this);
        this.model.on('change:quote_time change:minWaiting', this._changeWaitTimeColor, this);
        this.model.on('change:minutesInStore', this._changeMinutesInStoreText, this);
        this.model.on('change:call_ahead_type change:res_type', this._toggleEntryTypeClassName, this); // TODO move css style rules for res-entry and cas-entry
        this.model.on('change:ping_count', this._changePingCount, this);
        this.model.on('change', this.render, this);
    },

    /**
     * Renders the entire entry 
     * Only use during initailization and when an attribute changes that requires another
     * render, but that should be rare as we only want to render pieces of the view
     * @param EntryModel model to be rendered
     * @return EntryView this
     */
    render: function (model) {
        if ( typeof model === 'undefined' || _.chain(model.changedAttributes()).keys().intersection(this.whitelistedAttributes).value().length > 0 ) {
            var waitlistContainerEl = this.el.querySelector('.waitlist_container'),
                isRendered = waitlistContainerEl !== null,
                content = this.template(_.extend(this.model.toJSON(), { isRendered: isRendered }));

            if (isRendered) { // Don't render waitlist_container because it may have classNames
                waitlistContainerEl.innerHTML = content;
            }
            else { // Render the entire entry
                this.el.innerHTML = content;

                this._changeStatusClassName(this.model);
                this._toggleProfileClassName(this.model);
                this._toggleEntryTypeClassName(this.model);
                this._toggleSeatEntryClassName(this.model);
                this._toggleHasPhoneClassName(this.model);
                this._changeWaitTimeColor(this.model);

                if ( !! this.model.get('status_color') ) {
                    this._changeStatusColor(this.model);
                }

                if ( !! this.model.get('userResponse') ) {
                    this._toggleResponseClassName(this.model);
                }
            }
        }

        return this;
    },

    /**
     * Change the name of the entry
     * @param EntryModel model for this view
     * @return EntryView this
     */
    _changeName: function (model) {
        this.el.querySelector('.entry-name').innerText = model.get('name');
        return this;
    },

    /**
     * Change the waitlist container's className referring to status
     * @param EntryModel model containing the change
     * @return EntryView this
     */
    _changeStatusClassName: function (model) {
        var waitlistContainerEl = this.el.querySelector('.waitlist_container');
        waitlistContainerEl.className = waitlistContainerEl.className.replace(/status_\w+/g,'');
        waitlistContainerEl.classList.add('status_' + model.get('status'));
    },

    /**
     * Set a background color to party size or remove it
     * @param EntryModel model containing the change
     * @return EntryView this
     */
    _changeStatusColor: function (model) {
        this.el.querySelector('.party-size').style.backgroundColor = model.get('status_color');
        return this;
    },

    /**
     * Toggle between having or not having a profile icon on the button
     * @param EntryModel model containing the change
     * @return EntryView this
     */
    _toggleProfileClassName: function (model) {
        this.el.querySelector('.profile').classList.toggle('notempty', model.get('has_profile'));
    },

    /**
     * Process user response when there is one
     * @param EntryModel model for this view
     * @return EntryView this
     */
    _toggleResponseClassName: function (model) {
        var responseType = model.get('responseType'),
            classList = this.el.querySelector('.waitlist_container').classList;

        classList.toggle('has_user_response', responseType === 'user');
        classList.toggle('has_error_response', responseType === 'error');
        return this;
    },

    /**
     * Toggle between seat or check-in entry button depending
     * @param EntrModel model for this view
     * @return EntryView this
     */
    _toggleSeatEntryClassName: function (model) {
        var classList = this.el.querySelector('.sat').classList,
            entry = model.pick('res_type', 'call_ahead_type', 'checkedin_at', 'call_ahead_checkedin_at'),
            showCheckInButton = (entry.res_type || entry.call_ahead_type) && entry.checkedin_at === null && entry.call_ahead_checkedin_at === null;

        classList.toggle('check-in', showCheckInButton);
        return this;
    },

    /**
     * Update the phone number
     * @param EntryModel model for this view
     * @return EntryView this
     */
    _changePhone: function (model) {
        this.el.querySelector('.phone').innerText = model.get('phone');
        return this;
    },

    /**
     * Tag if an entry has no phone
     * @param EntryModel model for this view
     * @return EntryView this
     */
    _toggleHasPhoneClassName: function (model) {
        this.el.querySelector('.notify').classList.toggle('nophone', ! model.get('hasPhone'));
        return this;
    },

    /**
     * Update the value of the quoted time text
     * @param EntryModel model for this view
     * @return EntryView this
     */
    _changeQuotedTimeText: function (model) {
        this.el.querySelector('.minutes-quoted').innerText = model.get('quotedTimeText');
        return this;
    },

    /**
     * Update the value of waiting time
     * @param EntryModel model for this view
     * @return EntryView this
     */
    _changeWaitingTime: function (model) {
        this.el.querySelector('.minutes-waiting-text').innerText = model.get('minWaitingFormatted');
    },

    // TODO also update the color
    /**
     * Change the color of the quoted time if actual wait time is close to quoted
     * @param EntryModel model for this view
     * @return EntryView this
     */
    _changeWaitTimeColor: function (model) {
        var entry = model.pick('quoted_time', 'created_at_ts'),
            el = this.el.querySelector('.minutes-waited'),
            className = 'minutes-waited ';

        if (entry.quoted_time > 0) {
            var waitTime = ( new Date().getTime() / 1000 - parseInt(entry.created_at_ts, 10) ) / 60,
                differenceBetweenQuoteAndWaitTime = entry.quoted_time - waitTime;

            if ( (differenceBetweenQuoteAndWaitTime > 0) && 
                 (
                     (entry.quoted_time <= 15 && differenceBetweenQuoteAndWaitTime <= 3) ||
                     (entry.quoted_time > 15 && differenceBetweenQuoteAndWaitTime <= 5)
                 )
            ) {
                className += 'warning';
            }
            else if (waitTime >= entry.quoted_time) {
                className += 'alert';
            }

        }

        el.className = className;
        return this;
    },

    /**
     * Update the text for the minutes in store
     * @param EntryModel model for this view
     * @return EntryView this
     */
    _changeMinutesInStoreText: function (model) {
        var entry = model.pick('minutesInStoreLong', 'minutesInStoreShort');
        this.el.querySelector('.minutes-instore-longform-text').innerText = entry.minutesInStoreLong;
        this.el.querySelector('.minutes-instore-shortform-text').innerText = entry.minutesInStoreShort;
        return this;
    },

    /**
     * Tag reservation and call-ahead entries
     * @param EntryModel model for this view
     * @return EntryView this
     */
    _toggleEntryTypeClassName: function (model) {
        var classList = this.el.classList,
            entry = model.pick('res_type', 'call_ahead_type');

        classList.toggle('res-entry', !! model.get('res_type'));
        classList.toggle('cas-entry', !! model.get('call_ahead_type'));

        return this;
    },

    /**
     * Change the ping count number
     * @param EntryModel model for this view
     * @return EntryView this
     */
    _changePingCount: function (model) {
        var count = model.get('ping_count');
        if (count > 0) {
            this.el.querySelector('.notify_number').innerText = count;
            this.el.querySelector('.notify').classList.remove('hidden');
        }
        return this;
    },

});

/**
 * View for the entries collection
 */
var EntriesView = Backbone.View.extend({

    /**
     * Constructor
     * make sure to specify this.el which we'll be appending to
     */
    initialize: function (options) {
        this.queues = {
            current: [],
            wait: [],
            res: [],
            sat: []
        },

        this.collection.each(this._addToProperQueue, this);

        // listen to model changes
        this.collection.on('change:status', this._addToProperQueue, this);
        // this.collection.on('add', this._addToProperQueue?
        this.render();
    },

    events: {
        'click .show-more': '_showMore',
    },

    /**
     * Refreshes which entries to show
     */
    render: function () {
        var fragment = document.createDocumentFragment();
        _(this.queues.current).each(function (entryView) {
            fragment.appendChild(entryView.el);
        });
        this.el.appendChild(fragment);

        return this;
    },

    /**
     * Check which queue the entry belongs to then
     * add a view to that queue
     * @param EntryModel entry that needs to be queued
     * @return EntriesView this
     */
    _addToProperQueue: function (entry) {
        // queued
        if (entry.get('completed_at_ts') === null && !!! entry.get('res_type')) {
            this.queues.wait.push(new EntryView({ model: entry }));
        }
        else {
            // console.warn('Warning: this does not belong to any status queues');
            this.queues.wait.push(new EntryView({ model: entry }));
        }

        return this;
    },

    /**
     * Toggle whether to show more of the response text or not
     * @param n.Event ev is the event that was triggered by the element
     * @return EntriesView this
     */
    _showMore: function (ev) {
        var responseContainerEl = ev.currentTarget.parentElement; // we use currentTarget, which the eventListener is bound to, instead of target
        responseContainerEl.classList.toggle('showing-more');

        return this;
    }

});
