/**
 * Created by riggs on 1/24/16.
 */
"use strict";


var session = {
    log: []
};


var poller_ID = null;


function get_AMM_messages (callback) {
    // TODO: FIXME
    fetch(session.IP + "/messages", {
        method: 'GET'
    })
        .then(response => response.json())
        .then(json => {
            var messages = [];
            for (var item in json) {
                messages.push(item.message);
            }
            return messages;
        })
        .then(messages => callback(messages));
}



function message_poller () {

    get_AMM_messages(messages => session.log.push(...messages));

    poller_ID = setTimeout(message_poller, 0);

}


function send_AMM_message (message) {

    // FIXME: Actual IP data location.
    fetch(session.IP + "/action", {
        method: 'POST',
        headers: {
            "Content-type": "application/json; charset=UTF-8"
        },
        body: JSON.stringify({action: message})
    })
        .then(response => response.json())
        .then(json => console.log(json));

}


function scenario_init (scenario) {

    send_AMM_message('KEEP_HISTORY=TRUE');
    send_AMM_message('REGISTER=ADMIN');
    send_AMM_message('REGISTER=ERROR');
    send_AMM_message('REGISTER=ACT');
    send_AMM_message('REGISTER=PROX');
    send_AMM_message('REGISTER=SYS');
    send_AMM_message('REGISTER=SIM_TIME');
    send_AMM_message('REGISTER=STATUS');
    send_AMM_message('SYS=LOAD_SCENARIO:' + scenario);
    send_AMM_message('ADMIN=REQUEST_STATUS');

}

function init () {

    window.addEventListener('message', message => {
        console.log(message);
        var other_window = message.source;
        switch (message.data.name) {

            case "session":
                console.log(message.data.value);
                session = message.data.value;
                scenario_init(session.scenario);    // FIXME: Actual scenario data location.
                break;

            case "start_exercise":
                // TODO: Send Start message.
                break;

            case "end_exercise":
                // TODO: Send End message.
                break;

            case "results_request":
                // TODO: Evaluate scenario data.
                break;

            default:
                console.log(Date.now());
                console.log(message);

        }
    });

}

window.addEventListener('load', init);
