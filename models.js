/**
 * Model for a waitlist entry
 */
var EntryModel = Backbone.Model.extend({

    /**
     * default values
     * returns a function so that the default object is not shared among the all the instances
     */
    defaults: function () {
        return {
            response: '',
            minutesInStoreLong: '',
            minutesInStoreShort: ''
        };
    },


    /**
     * run first
     * add any filters here or set up event listeners
     * @param Object attributes for this entry
     */
    initialize: function (attributes) {
        // error checking
        if (attributes.id === null){
            // Logger.add('warn', 'Missing id in form data');
            console.warn('Missing id in form data');
        }

        this._changeCancelToNoShow();
        this._processResponse();
        this._formatQuotedTime();

        if (this.get('completed_at_ts') === null) {
            this.updateWaitingTime();
        }
        else {
            this._updateWaitedTime();
        }

        // listen for any changes to the data
        this.on('change:status', this._onStatus, this);
        this.on('change:userResponse', this._processResponse, this);
        this.on('change:quoted_time', this._formatQuotedTime, this);
        this.on('change:checkedin_at change:call_ahead_checkedin_at', this.updateWaitingTime, this);
    },

    /**
     * Calculate how long the party has been waiting for
     * @return EntryModel this
     */
    updateWaitingTime: function () {
        // this.minWaiting = Math.round( adjustedNow - parseInt(this.get('created_at_ts'), 10) / 60),
        // this.minWaitingFormatted = WLApp.Util.min_to_human(this.minWaiting);
        // WLApp.globals.adjustedNow
        var minWaiting = Math.floor( ( $.now()/1000 - this.get('created_at_ts') ) / 60 );
        this.set({
            minWaiting: minWaiting,
            minWaitingFormatted: minWaiting // this should be humanized
        });

        if (this._isCheckedIn()) {
            this._updateMinutesInStore();
        }

        return this;
    },

    /**
     * Hook for when status of the model changes
     */
    _onStatus: function () {
        this._changeCancelToNoShow();

        // update completed timestamp if we just moved to history list
        if ( /seat|noshow/i.test(this.get('status')) && ( this.get('completed_at_ts') === null || this._isSeatedFromNoShow() ) ) {
            //this.set('completed_at_ts', adjustedNow);
            this.set('completed_at_ts', Math.floor($.now() / 1000));
        }

        // we moved from history list back to current list
        if ( /queued|notify/i.test(this.get('status')) && this.get('completed_at_ts') !== null ) {
            this.set('completed_at_ts', null);
        }
    },

    /**
     * Process user/error response
     * @return EntryModel this
     */
    _processResponse: function () {
        // TODO use short-circuiting here if possible
        var response = this.get('userResponse'),
            hasResponse = this.get('completed_at_ts') === null && response !== null && response.length > 0,
            isError = response.match(/^Error:/),
            isUserResponse = WLApp.config.enableTwoWayText && this.get('status') !== 'usercancel';

        if ( hasResponse && ( isError || isUserResponse ) ) {
            if (isError) {
                return this.set({ response: response, responseType: 'error' });
            }
            else if (isUserResponse) {
                return this.set({ response: 'Response: ' + response, responseType: 'user' });
            }
        }
        else {
            return this.set({ response: "", responseType: "" });
        }
    },

    /**
     * Set it to noshow if status is cancel
     * @return EntryModel this
     */
    _changeCancelToNoShow: function () {
        if (this.get('status') === 'cancel') {
            this.set({ status: 'noshow' }, { silent: true }); // set to silent because the status just changed
        }

        return this;
    },

    /**
     * Convert quote time to readable format
     * @return EntryModel this
     */
    _formatQuotedTime: function () {
        var quotedTime = this.get('quoted_time');

        if (quotedTime > 0) {
            var hours = Math.floor( quotedTime / 60),
                minutes = quotedTime % 60;

            hours = hours < 1 ? '' : hours;
            minutes = minutes < 10 ? '0' + minutes : minutes;

            return this.set({ quotedTimeText: '(q'+hours+':'+minutes+')' });
        }
        else {
            return this.set({ quotedTimeText: '' });
        }
    },

    /**
     * Calculate how long the party waited
     * @return EntryModel this
     */
    _updateWaitedTime: function () {
        // this.minWaited = Math.round( this.get('completed_at_ts') - parseInt(this.get('created_at_ts'), 10) / 60),
        // this.minWaitedFormatted = WLApp.Util.min_to_human(this.minWaited);

        return this.set({
            minWaited: Math.round( ( this.get('completed_at_ts') - parseInt(this.get('created_at_ts'), 10) ) / 60),
            minWaitedFormatted: this.minWaited // this should be humanized
        });
    },

    /**
     * Calculate how long the party has been waiting at the venue once checked in
     * This will also be called upon check in
     * @return EntryModel this
     */
    _updateMinutesInStore: function () {
        var adjustedNow = Math.floor($.now()/1000), // use global adjustedNow
            checkedInAt = this.get('checkedin_at') || this.get('call_ahead_checkedin_at'), // XXX one of these two have go to have a value, given that entry has checked in
            checkinDifference = (adjustedNow - checkedInAt),
            minutesInStore =  checkinDifference < 0 ? 0 : checkinDifference / 60;

        return this.set({
            // minutesInStoreLong = WLApp.Util.min_to_human(Math.round(minutesInStore)),
            // minutesInStoreShort = Util.timeSince(checkedin_at, adjustedNow);
            minutesInStore: Math.round(minutesInStore),
            minutesInStoreLong: Math.round(minutesInStore),
            minutesInStoreShort: Math.round(minutesInStore) 
        });

        //$item.find(".minutes-instore .minutes").text(minutesInStoreLong);
        //$item.find(".minutes-instore .short").text(
    },

    /**
     * Check if we are seating an entry from no-show status
     * @return bool
     */
    _isSeatedFromNoShow: function () {
        return this.previousAttributes().status === 'noshow' && this.get('status') === 'seat';
    },

    /**
     * Check if entry is checked in
     * @return bool
     */
    _isCheckedIn: function () {
        var entry = this.pick('checkedin_at', 'call_ahead_checkedin_at');

        return ( entry.checkedin_at !== null && entry.checkedin_at > 0 ) ||
               ( entry.call_ahead_checkedin_at !== null && entry.call_ahead_checkedin_at > 0 );
    },

});

/**
 * A collection of entries
 */
var EntriesCollection = Backbone.Collection.extend({
    model: EntryModel,

    initialize: function (options) {
        this.intervalId = setInterval(this._onInterval.bind(this), 60000);
    },

    /**
     * This runs every minute
     */
    _onInterval: function () {
        this.each(function (entry) { // TODO only entries that are queued
            entry.updateWaitingTime();
        });
    }
});
