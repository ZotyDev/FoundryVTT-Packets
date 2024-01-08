////////////////////////////////////////////////////////////////////////////////
//                   _____           _        _                               //
//                  |  __ \         | |      | |                              //
//                  | |__) |_ _  ___| | _____| |_ ___                         //
//                  |  ___/ _` |/ __| |/ / _ \ __/ __|                        //
//                  | |  | (_| | (__|   <  __/ |_\__ \                        //
//                  |_|   \__,_|\___|_|\_\___|\__|___/ LIBRARY                //
//                                                       By ZotyDev           //
////////////////////////////////////////////////////////////////////////////////
// ? Packets provides users with a easy way to manage data that otherwise would
// ? be hard to manage, such as JSONs and caches.
// ? It does the hard work for you and exposes a API to be used without worrying
// ? about the little details.
import { Constants as C } from "./constants.js";
import { Packets } from "./packets.js";

////////////////////////////////////////////////////////////////////////////////
// Entry-point for everything
////////////////////////////////////////////////////////////////////////////////
Hooks.once('init', () => {
    Hooks.once('toolbox.ready', async () => {
        Toolbox.showcaseModule(C.NAME_FLAT);

        await Packets.initalize();

        // Setup the API
        window['Packets'] = {
            registerModule: Packets.registerModule,
            create: Packets.create,
        }

        C.D.info('Ready!');
    });

    // Register socketlib information
    Hooks.once('socketlib.ready', () => {
        C.SOCKET = socketlib.registerModule(C.ID);
        C.SOCKET.register('saveOnServer', Packets.saveOnServer);
        C.SOCKET.register('loadPackets', Packets.loadPackets);
        C.SOCKET.register('updateMirror', Packets.updateMirror);
        C.SOCKET.register('onUpdate', Packets.onUpdate);
    })

    // Debug info
    Hooks.once('debugger.ready', () => {
        C.D = new Debugger(C.ID, C.NAME, true, true);
        C.D.info('Module Information:');
        C.D.info(`Version ${game.modules.get(C.ID).version}`);
        C.D.info('Library By ZotyDev');
    });
});

Hooks.once('packets.updated', (packet) => {
    // Debug
    C.D.warn(`"${packet}" packet got updated somewhere`);
})
