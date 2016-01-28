/**
 * Created by riggs on 1/24/16.
 */
"use strict";


let PHYSIOLOGY_VARIABLES = [
    "BLOOD_PRESSURE_DIASYSTOLIC",
    "BLOOD_PRESSURE_SYSTOLIC",
    "CORE_TEMP",
    "HEART_RATE",
    "MAP",
    "RESPIRATORY_RATE",
    "SAT_OXYGEN",
];


var physiology_data = {};
PHYSIOLOGY_VARIABLES.forEach(value => physiology_data[value] = null);


let ui = {
    start_sim: null,
    end_sim: null,
    logger: null,
    physiology: null,
};


var poller_callback = null;
var poller_ID = null;


var session = {
    scenario: "SCENARIO_1",
    log: [],
    attached_modules: [],
    required_modules: [],
};


session.IP = "192.168.1.101";


var logger = function (message) {
    ui.log.textContent += (message + "\n");
    ui.log.scrollTop = ui.log.scrollHeight;
};


function get_AMM_messages(callback) {
    fetch("http://" + session.IP + "/refresh", {
        method: 'GET'
    })
        .then(response => response.json())
        /*
        .then(json => {
        console.log(json);
        return json;
        })
        */
        .then(messages => messages[0] != "NOMSGS" ? callback(messages[0]) : null);
}


function _scenario_running (messages) {
    session.log.push(Date.now());
    messages.forEach(msg => {
        session.log.push(msg);
        if (msg === "ERROR=NO_IV") {
            logger("IV not in place.");
        } else if (msg === "ADMIN=FORCE_EXIT") {
            setTimeout(on_sim_end, 0);
        } else {
            var split = msg.split('='),
                prefix = split[0],
                value = split[1];
            if (typeof physiology_data[prefix] !== "undefined") {
                physiology_data[prefix] = value;
            }
        }
    });
}


function _in_startup (messages) {
    for (var msg in messages) {
        var split = msg.split('='),
            prefix = split[0],
            value = split[1];
        switch (prefix) {
            case "MODULES":
                session.attached_modules = value.split(",").sort();
                break;
            case "STATUS":
                if (value === "READY") {
                    if (session.attached_modules === session.required_modules) {
                        ui.start_sim.disabled = false;
                        poller_callback = _scenario_running;
                    } else if (session.attached_modules.length === 0) {
                        send_AMM_message('ADMIN=REQUEST_MODULES');
                    } else {
                        var missing = [];
                        session.required_modules.forEach(module => {
                            if (!session.attached_modules.contains(module)) {
                                missing.push(module);
                            }
                        });
                        missing.forEach(module => {
                            logger("Missing " + module + " module.");
                            send_AMM_message("ERROR=MISSING:" + module);
                        });
                        setTimeout(() => send_AMM_message('ADMIN=REQUEST_MODULES'), 2000);
                    }
                }
                break;
            case "ADMIN":
                switch (value) {
                    case "START_SIM":
                        on_sim_start();
                        break;
                    case "FORCE_EXIT":
                        on_sim_end();
                        break;
                }
                break;
            default:
                session.log.push(Date.now());
                session.log.push(msg);
        }
    }
}
poller_callback = _in_startup;


function message_poller () {

    poller_ID = setTimeout(message_poller, 0);

    get_AMM_messages(poller_callback);

}


function kill_poller () {
    clearTimeout(poller_ID);
}


function send_AMM_message (message) {

    // FIXME: Actual IP data location.
    fetch('http://' + session.IP + "/action", {
        method: 'POST',
        headers: {
            "Content-type": "application/json; charset=UTF-8"
        },
        body: JSON.stringify({action: message})
    })
        .then(response => response.json())
        //.then(json => console.log(json))
        ;

}


function on_sim_start () {
    logger("Starting Scenario.");
    ui.end_sim.disabled = false;
    ui.start_sim.disabled = true;
    poller_callback = _scenario_running;
}


function on_sim_end () {
    logger("Ending Scenario.");
    ui.end_sim.disabled = true;
    ui.start_sim.disabled = true;
    setTimeout(kill_poller, 5000);
}


function scenario_init (scenario) {

    send_AMM_message('KEEP_HISTORY=FALSE');
    send_AMM_message('REGISTER=ADMIN');
    send_AMM_message('REGISTER=ACT');
    send_AMM_message('REGISTER=ERROR');
    send_AMM_message('REGISTER=MODULES');
    send_AMM_message('REGISTER=SIM_TIME');
    send_AMM_message('REGISTER=STATUS');
    PHYSIOLOGY_VARIABLES.forEach(variable => send_AMM_message('REGISTER=' + variable));
    send_AMM_message('SYS=LOAD_SCENARIO:' + scenario);
    send_AMM_message('ADMIN=REQUEST_STATUS');
    send_AMM_message('ADMIN=REQUEST_MODULES');

    message_poller();

}


function physiology_display () {

    PHYSIOLOGY_VARIABLES.forEach(variable => {
        ui[variable].textContent = variable + ": " + physiology_data[variable];
    })

}


function ui_init () {

    for (var k in ui) {
        var element = document.getElementById(k);
        if (!element) {
            throw "Missing UI element: " + k;
        }
        ui[k] = element;
    }

    ui.start_sim.addEventListener('click', () => {
        send_AMM_message("ADMIN=START_SIM");
        on_sim_start();
    });

    ui.end_sim.addEventListener('click', () => {
        send_AMM_message("ADMIN=FORCE_EXIT");
        on_sim_end();
    });

    PHYSIOLOGY_VARIABLES.forEach(variable => {
        var div = document.createElement('div');
        div.id = variable;
        ui.physiology.appendChild(div);
        ui[variable] = div;
    });

    setInterval(physiology_display, 500);

}


function init () {

    ui_init();

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

    //scenario_init(session.scenario);

}


window.addEventListener('load', init);
