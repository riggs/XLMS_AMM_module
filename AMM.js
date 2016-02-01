/**
 * Created by riggs on 1/24/16.
 */
"use strict";


let PHYSIOLOGY_VARIABLES = [
    "BLOOD_LOSS",
    "BLOOD_PRESSURE_DIASTOLIC",
    "BLOOD_PRESSURE_SYSTOLIC",
    "CORE_TEMP",
    "HEART_RATE",
    "MAP",
    "RESPIRATORY_RATE",
    "SAT_OXYGEN",
];


var physiology_data = {};
// Initialize physiology_data with PHYS_VARS keys, null values.
PHYSIOLOGY_VARIABLES.forEach(value => physiology_data[value] = null);
physiology_data.keys = Object.keys(physiology_data);


let ui = {
    start_sim: null,
    end_sim: null,
    log: null,
    physiology: null,
};


var POLLER_CALLBACK = null;
var POLLER_ID = null;


var session = {
    scenario: "SCENARIO_1",
    log: [],
    attached_modules: [],
    required_modules: ['XLMS'],
};


session.IP = "192.168.1.101";


var logger = function (message) {
    ui.log.textContent += (message + "\n");
    ui.log.scrollTop = ui.log.scrollHeight;
};


function get_AMM_messages(callback) {
    fetch("http://" + session.IP + "/refresh_xlms", {
        method: 'GET'
    })
        .then(response => response.ok ? response.json() : [["NOMSGS"]],
              error => console.log("Fetch failed: " + error))
        //.then(json => {console.log(json); return json;})
        .then(messages => callback(messages[0]),
              error => console.log("JSON failed: " + error));
}


function _scenario_running (messages) {
    messages.forEach(msg => {
        if (msg === "NOMSGS") {return;}
        session.log.push([Date.now(), msg]);
        var split = msg.split('='),
            prefix = split[0],
            value = split[1];
        if (msg === "ADMIN=FORCE_EXIT") {
            on_sim_end();
        } else if (msg === "ERROR=NO_IV") {
            logger("IV not in place.");
        } else if (prefix !== "SIM_TIME") {
            if (physiology_data.keys.includes(prefix)) {
                physiology_data[prefix] = value;
            } else {
                logger(msg);
            }
        }
    });
}


function _in_startup (messages) {
    messages.forEach(msg => {
        if (msg === "NOMSGS") {return;}
        console.log(msg);
        var split = msg.split('='),
            prefix = split[0],
            value = split[1];
        switch (prefix) {
            case "MODULES":
                session.attached_modules = value.split(",").sort();
                break;
            case "STATUS":
                if (value === "READY") {
                    if (session.attached_modules.length === 0) {
                        queue_AMM_message('ADMIN=REQUEST_MODULES');
                        queue_AMM_message('ADMIN=REQUEST_STATUS', 1000);
                    } else if (session.attached_modules === session.required_modules ||
                        // If every required module is attached
                        session.required_modules.every(module => session.attached_modules.includes(module)))
                    {
                        logger("System Ready");
                        ui.start_sim.disabled = false;
                        POLLER_CALLBACK = _scenario_running;
                    } else {
                        var missing = [];
                        session.required_modules.forEach(module => {
                            if (!session.attached_modules.includes(module)) {
                                missing.push(module);
                            }
                        });
                        missing.forEach(module => {
                            logger("Missing " + module + " module.");
                            queue_AMM_message("ERROR=MISSING:" + module);
                        });
                        queue_AMM_message('ADMIN=REQUEST_MODULES', 500);
                        queue_AMM_message('ADMIN=REQUEST_STATUS', 1000);
                    }
                }
                break;
            case "SYS":
                logger(msg);
                switch (value) {
                    case "START":
                        on_sim_start();
                        break;
                    case "FORCE_EXIT":
                        on_sim_end();
                        break;
                }
                break;
            default:
                session.log.push([Date.now(), msg]);
                logger(msg);
        }
    })
}
POLLER_CALLBACK = _in_startup;


function message_poller (delay) {

    delay = delay || 500;

    POLLER_ID = setTimeout(message_poller, delay);

    get_AMM_messages(POLLER_CALLBACK);

}


function kill_poller () {
    clearTimeout(POLLER_ID);
}


function queue_AMM_message (message, delay) {

    delay = delay || 0;

    console.log("Queuing: " + message);

    setTimeout(() => {
        // FIXME: Actual IP data location.
        fetch('http://' + session.IP + "/action_xlms", {
            method: 'POST',
            headers: {
                "Content-type": "application/json; charset=UTF-8"
            },
            body: JSON.stringify({action: message})
        })
            .then(response => response.json())
            //.then(json => console.log(json))
        ;
    }, delay);
}


function on_sim_start () {
    logger("Starting Scenario.");
    ui.end_sim.disabled = false;
    ui.start_sim.disabled = true;
    POLLER_CALLBACK = _scenario_running;
}


function on_sim_end () {
    logger("Ending Scenario.");
    ui.end_sim.disabled = true;
    ui.start_sim.disabled = true;
    setTimeout(kill_poller, 1000);
}


function scenario_init (scenario) {

    var delay = 0;

    function dont_spam (message) {
        queue_AMM_message(message, delay);
        delay += 100;
    }

    logger("Registering XLMS Module.");
    dont_spam('KEEP_HISTORY=FALSE');
    dont_spam('MODULE_NAME=XLMS');
    dont_spam('REGISTER=ADMIN');
    dont_spam('REGISTER=SYS');
    dont_spam('REGISTER=ACT');
    dont_spam('REGISTER=ERROR');
    dont_spam('REGISTER=MODULES');
    dont_spam('REGISTER=SIM_TIME');
    dont_spam('REGISTER=STATUS');
    PHYSIOLOGY_VARIABLES.forEach(variable => dont_spam('REGISTER=' + variable));
    dont_spam('ADMIN=LOAD_SCENARIO:' + scenario);
    dont_spam('ADMIN=REQUEST_STATUS');
    dont_spam('ADMIN=REQUEST_MODULES');

    POLLER_ID = setTimeout(() => message_poller(250), 5000);

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
        queue_AMM_message("ADMIN=START_SIM");
        on_sim_start();
    });

    ui.end_sim.addEventListener('click', () => {
        queue_AMM_message("ADMIN=FORCE_EXIT");
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
                session.XLMS_data = message.data.value;
                scenario_init(session.scenario);    // FIXME: Actual scenario data location.
                break;

            case "start_exercise":
                queue_AMM_message("ADMIN=START_SIM");
                on_sim_start();
                break;

            case "end_exercise":
                queue_AMM_message("ADMIN=FORCE_EXIT");
                on_sim_end();
                break;

            case "results_request":
                // TODO: Evaluate scenario data.
                break;

            default:
                console.log(Date.now());
                console.log(message);
        }
    });

    scenario_init(session.scenario);

}


window.addEventListener('load', init);
