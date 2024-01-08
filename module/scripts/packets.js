////////////////////////////////////////////////////////////////////////////////
//                   _____           _        _                               //
//                  |  __ \         | |      | |                              //
//                  | |__) |_ _  ___| | _____| |_ ___                         //
//                  |  ___/ _` |/ __| |/ / _ \ __/ __|                        //
//                  | |  | (_| | (__|   <  __/ |_\__ \                        //
//                  |_|   \__,_|\___|_|\_\___|\__|___/ LIBRARY                //
//                                                       By ZotyDev           //
////////////////////////////////////////////////////////////////////////////////
// ? This class represents a Packet, which is any amount of data into the same
// ? group. A Packet use-case example is the use of custom settings, if you want
// ? to store highly specific settings (such as me with OIF) you might encounter
// ? some difficulties along the way, be it loading said settings or event
// ? sending them between players and DMs.
import { Constants as C } from "./constants.js";

export class Packets {
    static packets = new Map();
    static config = {
        // A array containing the registered modules
        modules: [],
        // A array containing all files that should be loaded
        packets: [],
    }

    ////////////////////////////////////////////////////////////////////////////
    // Constructor
    ////////////////////////////////////////////////////////////////////////////
    constructor(id, data) {
        this.id = id;
        this.data = data;
    }

    ////////////////////////////////////////////////////////////////////////////
    // Initialize the module
    ////////////////////////////////////////////////////////////////////////////
    static async initalize() {
        // Debug
        C.D.info('Packets.initialize()');
        C.D.info('Initializing module...');

        // Create the required folders and files if necessary
        // ? To prevent previous errors such as data not existing for some
        // ? reason, any user that can do it, will do it. This away the first
        // ? chance the module gets to create the necessary files will be used
        if (Toolbox.can(['FILES_BROWSE', 'FILES_UPLOAD'])) {
            // Debug
            C.D.info('User has enough permissions to make sure required folders and files exist');

            // Create the root folder if it doesn't exist
            await Toolbox.makeSure('./packets');
            await Toolbox.makeSure('./packets/modules');

            // Create the config file if necessary
            await Toolbox.makeSure('./packets/packets.json', Packets.config);

            // Debug
            C.D.info('All the required folders and files are now present');
        } else {
            // Debug
            C.D.info('User lacks permissions to make sure required folders and files exist');
        }

        // Register the setting that acts as a mirror
        // ? This config serves only one purpose, being a second option for
        // ? players that join alone and, for some reason, will use a packet.
        // ? When this happen, the players don't have someone to ask for the
        // ? data, and thus will need to load it from the config.
        // ? Thats the only reason why config exists, it is not trustable, and
        // ? it is always JUST a mirror of the packets saved on the server.
        game.settings.register(C.ID, 'packetsMirror', {
            scope: 'world',
            type: String,
            default: JSON.stringify({
                packets: Array.from(Packets.packets).map(([name, packet]) => {name, packet}),
                config: Packets.config,
            }),
        });

        // Load config and registered packets
        if (Toolbox.can(['FILES_BROWSE', 'FILES_UPLOAD'])) {
            // Debug
            C.D.info('User has enough permissions to load the registered packets');

            // Load config
            Packets.config = await Toolbox.loadFile('./packets/packets.json');

            // Load packets
            await Packets.loadPackets();

            // Update the mirror (if possible)
            Packets.updateMirror();
        } else {
            // Debug
            C.D.info('User lacks permissions to load the registered packets, requesting from another user');

            // Request the registered packets config to be loaded from another player
            const user = Toolbox.anyoneWhoCan(['FILES_BROWSE', 'FILES_UPLOAD']);
            if (foundry.utils.isEmpty(user)) {
                // Debug
                C.D.warn('Could not load registered packets, no user with enough permissions is online');

                // Warn the player that data could be outdated
                // ? There is only two cases where data will be outated
                // ? First one is when the data gets changed directly on the
                // ? server, and the second one is when someone does a change
                // ? and exits foundry just before the data being saved as a
                // ? config. Other than these two situations, the data will
                // ? always be updated.
                ui.notifications.warn(game.i18n.localize('packets.warn.noFirstLoadPermission'));

                Packets.loadFromMirror();
            } else {
                // Debug
                C.D.info(`Requesting mirror update from the user "${user.name}"`);

                await C.SOCKET.executeAsUser('updateMirror', user.id);

                // Debug
                C.D.info(`User "${user.name}" updated the mirror`);

                // Load packets from the mirror
                Packets.loadFromMirror();

                let mirrorData = JSON.parse(game.settings.get('packets', 'packetsMirror'));
                for (const packet of mirrorData.packets) {
                    C.D.info(packet);
                }
            }
        }

        // Call the ready hook for Packets
        Hooks.call('packets.ready');
    }

    ////////////////////////////////////////////////////////////////////////////
    // Loads all registered Packets
    ////////////////////////////////////////////////////////////////////////////
    static async loadPackets() {
        // Debug
        C.D.info('Packets.loadPackets()');
        C.D.info('Loading the registered packets');

        let configChanged = false;
        for (const packet of Packets.config.packets) {
            const truePath = `packets/modules/${packet}`;

            // Debug
            C.D.info(`Loading packet registered at ${truePath}`);

            const result = await Toolbox.loadFile(truePath);
            // Check if the file exists
            // ? if the file does not exist, then it no longer serves a purpose,
            // ? we can unregister and delete it
            if (foundry.utils.isEmpty(result)) {
                // Debug
                C.D.warn(`Could not find "${truePath}", unregistering it since it no longer serves a purpose`);

                const indexOfPacket = Packets.config.packets.lastIndexOf(packet);
                Packets.config.packets.splice(indexOfPacket, 1);
                configChanged = true;
            // If the file exist we add the data to the current packets
            } else {
                const loadedPacket = new Packets(result.id, result);
                Packets.packets.set(result.id, loadedPacket);

                // Debug
                C.D.info(`Successfully loaded packet registered at ${truePath}`);
            }
        }

        // Save config if changes were made
        if (configChanged) {
            // Debug
            C.D.info('Atleast one packet got loaded, saving the config');

            await Toolbox.saveFile('./packets/packets.json', Packets.config);
        } else {
            // Debug
            C.D.info("No packets registered, config didn't change");
        }

        // Debug
        C.D.info('Packets loading is complete');
    }

    ////////////////////////////////////////////////////////////////////////////
    // Register a module
    ////////////////////////////////////////////////////////////////////////////
    static async registerModule(module) {
        // Debug
        C.D.info('Packets.registerModule()');
        C.D.info(`Registering the "${module}" module`);

        // Check if module is already registered
        if (Packets.config.modules.includes(module)) {
            // If a module is already registered we don't want to register it
            // again or notify the user

            // Debug
            C.D.warn('Tried to register a already registered module');

            return;
        }

        // Check if the module is currently loaded
        if (!game.modules.has(module)) {
            // Debug
            C.D.error("Cant't register modules that are not currently active");

            return;
        }

        // Add module to the config
        Packets.config.modules.push(module);

        // Save the config
        await Toolbox.saveFile('./packets/packets.json', Packets.config);

        // Create the folder if it does not exist yet
        if (Toolbox.can(['FILES_BROWSE', 'FILES_UPLOAD'])) {
            await Toolbox.makeSure(`./packets/modules/${module}`);
        }

        // Debug
        C.D.info(`Successfully registered the "${module}" module`);
    }

    ////////////////////////////////////////////////////////////////////////////
    // Creates a Packet
    // ? When a Packet gets created it is registered as a static value inside
    // ? the Packet class. This is to prevent the data being lost and to make it
    // ? easier to handle using sockets
    ////////////////////////////////////////////////////////////////////////////
    static create(data, override) {
        // Debug
        C.D.info('Packets.create()');
        C.D.info('Creating a new packet');

        // Check for required information
        if (foundry.utils.isEmpty(data)) {
            // Debug
            C.D.error('Invalid data', data);

            return;
        }

        if (foundry.utils.isEmpty(data.id)) {
            // Debug
            C.D.error('Missing "id"');

            return;
        }

        if (foundry.utils.isEmpty(data.module)) {
            // Debug
            C.D.error('Missing "module"');

            return;
        }

        // Check if module is registered
        if (!Packets.config.modules.includes(data.module)) {
            // Debug
            C.D.error(`Trying to create a packet for a unregistered module "${module}"`);

            return;
        }

        // Check if the module is currently loaded
        if (!game.modules.has(data.module)) {
            // Debug
            C.D.error(`Trying to create a packet for a unloaded module "${module}"`);

            return;
        }

        // Check if doesn't exist
        const newPacketPath = `${data.module}/${data.id}.json`
        if (!Packets.config.packets.includes(newPacketPath)) {
            // Debug
            C.D.info(`"${data.id}" packet does not exist, creating it`);

            // Create a Packet instance with the data
            const newPacket = new Packets();
            newPacket.data = data;

            // Insert the packet location into memory
            Packets.config.packets.push(newPacketPath);

            // Insert the packet data into memory
            Packets.packets.set(data.id, data);

            // Save the Packet
            newPacket.save();

            // Save the config
            // ? Does not need to wait since we don't care about the file state
            // ? right after creation
            Toolbox.saveFile('./packets/packets.json', Packets.config);

            return newPacket;
        } else {
            // Debug
            C.D.info(`"${data.id}" packet already exists, loading from memory`);

            // Load the packet if it already exists
            let loadedPacket = Packets.packets.get(data.id);

            // If override is set, override the loaded packet data with the
            // new data passed
            if (override) {
                // Debug
                C.D.info(`"${data.id}" got loaded with override set, data will be replaced`);

                loadedPacket.data = data;
                loadedPacket.save();
            }

            return loadedPacket;
        }
    }

    ////////////////////////////////////////////////////////////////////////////
    // Save the Packet on the server as a JSON file
    ////////////////////////////////////////////////////////////////////////////
    static async saveOnServer(packet) {
        // Debug
        C.D.info('Packets.saveOnServer()');
        C.D.info(`Using current user permissions to save the "${packet.data.id}" on the server`);

        // Creates a new file from the Packet data
        const result = await Toolbox.saveFile(`./packets/modules/${packet.data.module}/${packet.data.id}.json`, packet.data);
        if (foundry.utils.isEmpty(result)) {
            // Debug
            C.D.error(`Failed to save the "${packet.data.id}" packet on the server`);

            return false;
        }

        // Debug
        C.D.info(`Successfully saved the "${packet.data.id}" packet on the server`);

        return true;
    }

    ////////////////////////////////////////////////////////////////////////////
    // Method executed for everyone when a Packet gets updated
    ////////////////////////////////////////////////////////////////////////////
    static onUpdate(packet) {
        // Debug
        C.D.info('Packets.onUpdate()');
        C.D.info(`Packet "${packet}" got updated somewhere and will have its data on memory updated (use <packet>.reload() to update a specific instance of this packet)`);

        // Reload the packet data
        const rawData = game.settings.get(C.ID, 'packetsMirror');
        const allData = JSON.parse(rawData);

        const packetData = allData.packets.find((element) => element.name == packet);

        // Load the new data
        Packets.packets.set(packetData.name, packetData.value);

        // Debug
        C.D.info(`Successfully updated the "${packet}" packet`);

        // Call the hook
        Hooks.call('packets.updated', packet);
    }

    ////////////////////////////////////////////////////////////////////////////
    // Save everything completely
    ////////////////////////////////////////////////////////////////////////////
    async save() {
        // Debug
        C.D.info('Packets.save()');
        C.D.info(`Saving the "${this.data.id}" packet`);

        // If the user has enough permissions save the Packet and notify all the
        // other users about the changes
        if (Toolbox.can(['FILES_BROWSE', 'FILES_UPLOAD'])) {
            // Debug
            C.D.info('Current user has enough permissions to save the packet on the server, running save locally');

            // Save the packet on server
            await Packets.saveOnServer(this);

            // Update the mirror (if possible)
            Packets.updateMirror();

            // Updates the data for others
            C.SOCKET.executeForOthers('onUpdate', this.data.id);
        // If the user lacks enough permissions, request it from someone else
        } else {
            // Debug
            C.D.info('Current user lacks enough permissions to save the packet on the server, searching for a user with enough permissions...');

            // Find the first user that has enough permissions
            let user = Toolbox.anyoneWhoCan(['FILES_BROWSE', 'FILES_UPLOAD']);
            if (!foundry.utils.isEmpty(user)) {
                // Debug
                C.D.info(`User "${user.name}" has enough permissions, requesting save`);

                const result = await C.SOCKET.executeAsUser('saveOnServer', user.id, this);
                if (foundry.utils.isEmpty(result)) {
                    // Debug
                    C.D.error(`Failed to save`);

                    return;
                } else {
                    // Save the packet on server
                    await Packets.saveOnServer(this);

                    // Update the mirror (if possible)
                    Packets.updateMirror();

                    // Updates the data for others
                    C.SOCKET.executeForOthers('onUpdate', this.data.id);
                }
            // No active players have enough permission
            } else {
                // Debug
                C.D.error(`Couldn't find any user with enough permissions to save the "${this.data.id}" packet on server`);

                ui.notifications.error(game.i18n.localize('packets.error.noSavePermission'));
                return;
            }
        }
    }

    ////////////////////////////////////////////////////////////////////////////
    // Reload the data
    // ? Should be called when data needs to be reloaded
    ////////////////////////////////////////////////////////////////////////////
    async reload() {
        // Debug
        C.D.info('Packets.reload()');
        C.D.info(`Trying to reload the "${this.data.id}" packet`);

        // Check if the packet still exists
        if (Packets.packets.has(this.data.id)) {
            // Debug
            C.D.info(`Packet data found, loading it`);

            // Load the new data from the static map
            let newData = Packets.packets.get(this.data.id);
            this.data = newData;

            // Debug
            C.D.info(`Successfully reloaded the "${this.data.id}" packet`);
        } else {
            // Debug
            C.D.info(`Could not find the "${this.data.id}" packet`);
        }
    }

    ////////////////////////////////////////////////////////////////////////////
    // Update the mirror
    ////////////////////////////////////////////////////////////////////////////
    static updateMirror() {
        // Debug
        C.D.info('Packets.updateMirror()');

        // Update the mirror (if possible)
        if (Toolbox.can(['SETTINGS_MODIFY'])) {
            // Debug
            C.D.info('Current user had enough permissions and updated the mirror to match the server file');

            const data = {
                packets: Array.from(Packets.packets, ([name, value]) => ({ name, value })),
                config: Packets.config,
            };

            // Debug
            C.D.info('Data that will be inserted at the mirror:', data);

            game.settings.set(C.ID, 'packetsMirror', JSON.stringify(data));

            // Debug
            C.D.info('Successfully updated mirror');
        } else {
            // Debug
            C.D.info('Current user could not update the mirror to match the server file');
        }
    }

    ////////////////////////////////////////////////////////////////////////////
    // Load from the mirror
    ////////////////////////////////////////////////////////////////////////////
    static loadFromMirror() {
        // Debug
        C.D.info('Packets.loadFromMirror()');

        const rawData = game.settings.get(C.ID, 'packetsMirror');
        const data = JSON.parse(rawData);

        // Delete old data to prevent trash laying around
        delete Packets.config;
        delete Packets.packets;

        // Recreate data
        Packets.packets = new Map();

        // Load each one of the packets
        for (const packet of data.packets) {
            Packets.packets.set(packet.name, packet.value);
        }

        // Load the config
        Packets.config = data.config;

        // Debug
        C.D.info('Successfully loaded from mirror:', Packets.config, Packets.packets);
    }
}
