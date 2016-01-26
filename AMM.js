/**
 * Created by riggs on 1/24/16.
 */
"use strict";


var session = {
    log: []
};


session.IP = "192.168.1.101";


function get_AMM_messages (poller_ID, callback) {
    // TODO: FIXME
    try {
        fetch("http://" + session.IP + "/refresh", {
            method: 'GET'
        })
            .then(response => response.json())
            .then(json => {
                console.log(json);
                return json;
            })
            .then(messages => messages[0] != "NOMSGS" ? callback(messages[0]) : null);
    } catch (e) {
        if (e instanceof TypeError) {
            clearTimeout(poller_ID);
        } else {
            throw e;
        }
    }
}



function message_poller () {

    var poller_ID = setTimeout(message_poller, 0);

    get_AMM_messages(poller_ID, messages => session.log.push(...messages));

}


function send_AMM_message (message) {

    // FIXME: Actual IP data location.
    fetch('http://' + session.IP + "/action", {
        method: 'POST',
        headers: {
            "Content-type": "application/json; charset=UTF-8",
            //"no-cors": ""
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
    send_AMM_message('REGISTER=HEART_RATE');
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

                setTimeout(message_poller, 0);
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
