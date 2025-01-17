import { ConditionsLimit, ModuleCategory } from "../constants";
import { registerCommand } from "../modules/commandsModule";
import { ChatRoomActionMessage, ChatRoomSendLocal, getCharacterName } from "../utilsClub";
import { hookFunction } from "../patching";
import { registerSpeechHook, SpeechHookAllow, SpeechMessageInfo } from "../modules/speech";
import { getAllCharactersInRoom } from "../characters";
import { Command_fixExclamationMark, Command_pickAutocomplete } from "../modules/commands";

export function initCommands_speech() {
	registerCommand("forcesay", {
		name: "Forced say",
		helpDescription: `<text>`,
		shortDescription: "Makes PLAYER_NAME instantly say the text",
		longDescription:
			`This command forces PLAYER_NAME to directly say the given text loudly in the chat room, without any way to react to it. The command is intentionally not supporting emotes, whispers or OOC text.\n` +
			`Usage:\n` +
			`!forcesay HELP_DESCRIPTION`,
		defaultLimit: ConditionsLimit.blocked,
		playerUsable: false,
		trigger: (argv, sender, respond, state) => {
			if (argv.length < 1) {
				respond(Command_fixExclamationMark(sender,
					`!forcesay usage:\n` +
					`!forcesay ${state.commandDefinition.helpDescription}`
				));
				return false;
			}
			const sentence = argv.join(" ").trim();
			if (sentence.includes("(")) {
				respond(`The text after '.forcesay' must not contain OOC parts in round brackets`);
				return false;
			}
			if (/^[*!/.]/.test(sentence[0])) {
				respond(`The text after '.forcesay' must not start with '*', '/', '!', or '.'`);
				return false;
			}
			ServerSend("ChatRoomChat", { Content: sentence, Type: "Chat" });
			return true;
		}
	});

	let lastRoomName: string = "";
	let senderNumber: number | null = null;
	let sayText: string = "";
	let count: number = 0;
	registerCommand("say", {
		name: "Say",
		helpDescription: `<text> | cancel`,
		shortDescription: "Blocks PLAYER_NAME until she typed the text",
		longDescription:
			`This command makes PLAYER_NAME unable to say anything else than the given text loudly in the chat (she can still use emotes and whispers). The blocking lasts until the command giver cancels it with 'say cancel' command, leaves the room or until PLAYER_NAME leaves the room. The text is supposed to be typed out manually, otherwise the giver of the command will be notified of this. The command is intentionally not supporting emotes, whispers or OOC text.\n` +
			`Usage:\n` +
			`!say HELP_DESCRIPTION`,
		defaultLimit: ConditionsLimit.blocked,
		playerUsable: false,
		load() {
			// 1. hook ChatRoomSync to set default values if the room name is different from the one stored locally
			hookFunction("ChatRoomSync", 0, (args, next) => {
				const data = args[0];
				if (data.Name !== lastRoomName) {
					sayText = "";
					senderNumber = null;
				}
				next(args);
			}, ModuleCategory.Commands);
			hookFunction("CommonKeyDown", 4, (args, next) => {
				if (sayText) {
					count++;
				}
				next(args);
			}, ModuleCategory.Commands);
		},
		// 2. do not allow sending anything else
		init() {
			const check = (msg: SpeechMessageInfo): boolean => (
				(msg.noOOCMessage ?? msg.originalMessage).toLocaleLowerCase() === sayText.trim().toLocaleLowerCase() &&
				msg.type === "Chat"
			);
			registerSpeechHook({
				allowSend: (msg) => {
					if (sayText &&
						msg.type === "Chat"
					) {
						lastRoomName = ChatRoomData.Name;
						if (!getAllCharactersInRoom().some(c => c.MemberNumber === senderNumber)) {
							sayText = "";
							senderNumber = null;
							return SpeechHookAllow.ALLOW;
						}
						if (check(msg)) {
							if (senderNumber && sayText.length >= count) {
								ChatRoomActionMessage(`Note: ${Player.Name} did not type out the text '${sayText}' fully and likely ` +
									`used copy & paste or the chat history instead.`, senderNumber);
								ChatRoomSendLocal(`Note: It appears you didn't type out the text '${sayText}' fully and likely` +
									`used copy & paste or the chat history instead. The giver of the command has been notified of this.`);
							}
							sayText = "";
							senderNumber = null;
							return SpeechHookAllow.ALLOW_BYPASS;
						} else {
							ChatRoomSendLocal(`You are ordered to say '${sayText}'.`);
							return SpeechHookAllow.BLOCK;
						}
					}
					return SpeechHookAllow.ALLOW;
				}
			});
		},
		trigger: (argv, sender, respond, state) => {
			if (sayText && argv.length === 1 && argv[0].toLowerCase() === "cancel") {
				respond(`You canceled ${Player.Name}'s say-command. She is now able to chat normally again.`);
				ChatRoomSendLocal(`${sender} canceled your say-command. You are now able to chat normally again.`);
				sayText = "";
				senderNumber = null;
				return true;
			}
			if (sayText) {
				respond(`${Player.Name} is already ordered to say something else. Please wait until she is done or cancel the current say-command with '.say cancel'.`);
				return false;
			}
			if (typeTaskText) {
				respond(`${Player.Name} cannot receive a say-command, while still dealing with a typing task command.`);
				return false;
			}
			const sentence = argv.join(" ").trim();
			if (!sentence || argv.length < 1) {
				respond(Command_fixExclamationMark(sender,
					`!say usage:\n` +
					`!say ${state.commandDefinition.helpDescription}\n` +
					`!say cancel - Cancel the last unfulfilled say-command and stop ${Player.Name}'s chat block.`
				));
				return false;
			}

			if (sentence.includes("(")) {
				respond(`The text after '.say' must not contain OOC parts in round brackets`);
				return false;
			}
			if (/^[*!/.]/.test(sentence[0])) {
				respond(`The text after '.say' must not start with '*', '/', '!', or '.'`);
				return false;
			}
			count = 0;
			sayText = sentence;
			senderNumber = sender.MemberNumber;
			ChatRoomSendLocal(`${sender} orders you to loudly say '${sayText}'.`);
			return true;
		},
		autoCompleter: (argv) => {
			if (argv.length === 1 && sayText) {
				return Command_pickAutocomplete(argv[0], ["cancel"]);
			}
			return [];
		}
	});

	function resetTypeTask(): void {
		typeTaskText = "";
		senderNumber = null;
		repCounter = 0;
		repetitions = false;
	}
	/* typing task command type <number> <text> ,which blocks the target from sending any chat messages or whispers (except to the command source character / domme)
	until she typed the sentence <number> times as whisper message to the domme. Domme will receive the typed message as "<text> (1/10) (16 keystrokes)".
	Sending anything but the sentence in whisper to the domme will fail the task and end the chat block. Sending something while domme is no longer in the same
	room will also end the task and chat block. The <text> cannot contain () OOC or * or . or / at the start. */
	// might be resusable from the other command
	let typeTaskText: string = "";
	let repetitions: number | false = false;
	let repCounter: number = 0;
	registerCommand("typetask", {
		name: "Typing task",
		helpDescription: `<number> <text> | cancel`,
		shortDescription: "Orders PLAYER_NAME to type a text a few times",
		longDescription:
			`This command gives PLAYER_NAME the task to type the given text in a whisper to the task giver for the number of times defined in the command. This will block PLAYER_NAME from chatting or whispering to anyone other than the task giver (she can still use emotes). This state lasts until the task giver cancels it with 'typetask cancel' command, leaves the room or until PLAYER_NAME either makes a mistake or leaves the room. The command is intentionally not supporting emotes, whispers or OOC text.\n` +
			`Usage:\n` +
			`!typetask HELP_DESCRIPTION`,
		defaultLimit: ConditionsLimit.blocked,
		playerUsable: false,
		load() {
			// 1. hook ChatRoomSync to set default values if the room name is different from the one stored locally
			hookFunction("ChatRoomSync", 0, (args, next) => {
				const data = args[0];
				if (data.Name !== lastRoomName) {
					resetTypeTask();
				}
				next(args);
			}, ModuleCategory.Commands);
			hookFunction("CommonKeyDown", 4, (args, next) => {
				if (typeTaskText) {
					count++;
				}
				next(args);
			}, ModuleCategory.Commands);
		},
		// 2. do not allow sending anything else
		init() {
			const check = (msg: SpeechMessageInfo): boolean => (
				(msg.noOOCMessage ?? msg.originalMessage).toLocaleLowerCase() === typeTaskText.trim().toLocaleLowerCase() &&
				msg.type === "Whisper" && (ChatRoomTargetMemberNumber === senderNumber)
			);
			registerSpeechHook({
				allowSend: (msg) => {
					if (typeTaskText &&
						senderNumber &&
						(msg.type === "Chat" || msg.type === "Whisper")
					) {
						lastRoomName = ChatRoomData.Name;
						// end task as task giver is no longer in the room
						if (!getAllCharactersInRoom().some(c => c.MemberNumber === senderNumber)) {
							ChatRoomSendLocal(`Your current typing task ended prematurely, as the task giver is no longer in the room.`);
							resetTypeTask();
							return SpeechHookAllow.ALLOW;
						}
						if (check(msg)) {
							if (senderNumber && typeTaskText.length >= count) {
								// failure 1: typeTaskText.length > count  -> task failed
								ChatRoomActionMessage(`Note: ${Player.Name} failed the typing task as she did not type out the text '${typeTaskText}' fully and likely ` +
									`used copy & paste or the chat history instead.`, senderNumber);
								ChatRoomSendLocal(`You failed the typing task as you did not type out the text fully`);
								resetTypeTask();
							} else if (repCounter >= repetitions) {
								// successful all: whole task
								ChatRoomActionMessage(`${Player.Name} completed the typing task successfully`, senderNumber);
								ChatRoomSendLocal(`You completed the typing task successfully.`);
								resetTypeTask();
							} else {
								// successful once: single task iteration
								ChatRoomSendLocal(`Success: ${repCounter} of ${repetitions} times`);
								count = 0;
								repCounter++;
							}
							return SpeechHookAllow.ALLOW_BYPASS;
						} else {
							// failure 2: whispered to the wrong target -> block
							if (ChatRoomTargetMemberNumber !== senderNumber) {
								ChatRoomSendLocal(`You are not allowed to whisper to someone else than ${getCharacterName(senderNumber, "[unknown name]")} (${senderNumber}) while you have not finished your typing task.`);
								return SpeechHookAllow.BLOCK;
							}
							// failure 3: tried to speak in chat -> block
							if (msg.type === "Chat") {
								ChatRoomSendLocal(`You are not allowed to speak loudly in the room until you complete your typing task by whispering the required text to ${getCharacterName(senderNumber, "[unknown name]")} (${senderNumber}).`);
								return SpeechHookAllow.BLOCK;
							}
							// failure 4: whispered incorrect text to the task giver -> task failed
							ChatRoomActionMessage(`${Player.Name} typed the required text incorrectly and failed her task after ${repCounter} ${repCounter === 1 ? "time" : "times"} out of ${repetitions}.`, senderNumber);
							ChatRoomSendLocal(`You typed the required text incorrectly and failed your task after ${repCounter} ${repCounter === 1 ? "time" : "times"} out of ${repetitions}.`);
							resetTypeTask();
							return SpeechHookAllow.ALLOW;
						}
					}
					return SpeechHookAllow.ALLOW;
				}
			});
		},
		trigger: (argv, sender, respond, state) => {
			if (typeTaskText && argv.length === 1 && argv[0] === "cancel") {
				respond(`You canceled ${Player.Name}'s typetask-command. She is now able to chat normally again.`);
				ChatRoomSendLocal(`${sender} canceled your typetask-command. You are now able to chat normally again.`);
				resetTypeTask();
				return true;
			}
			if (typeTaskText) {
				respond(`${Player.Name} already has a typing task currently. Please wait until she is done or cancel the current one with '.typetask cancel'.`);
				return false;
			}
			if (sayText) {
				respond(`${Player.Name} cannot receive a typing task, while still blocked from a recent say-command.`);
				return false;
			}
			if (argv.length === 0) {
				respond(Command_fixExclamationMark(sender,
					`!typetask usage:\n` +
					`!typetask ${state.commandDefinition.helpDescription}\n` +
					`!typetask cancel - Cancel the last unfulfilled say-command and stop ${Player.Name}'s chat block.`
				));
				return false;
			}
			repetitions = /^[0-9]+$/.test(argv[0]) && Number.parseInt(argv[0], 10);
			if (!repetitions || repetitions === 0) {
				respond(`Needs a number (at least '1') for how often typing the text needs to be repeated after '.typetask' or specifically '.typetask cancel' to cancel the last unfulfilled typetask-command and stop ${Player.Name}'s chat and whisper block.'`);
				return false;
			}

			const sentence = argv.slice(1).join(" ").trim();
			if (argv.length < 2 || !sentence) {
				respond(`Needs a word or sentence after the number which is the text that needs to be repeatedly typed`);
				return false;
			}
			if (sentence.includes("(")) {
				respond(`The text after '.typetask' must not contain OOC parts in round brackets`);
				return false;
			}
			if (/^[*!/.]/.test(sentence[0])) {
				respond(`The text after '.typetask' must not start with '*', '/', '!', or '.'`);
				return false;
			}
			count = 0;
			repCounter = 1;
			typeTaskText = sentence;
			senderNumber = sender.MemberNumber;
			respond(`Successfully gave a new typing task to ${Player.Name}.`);
			ChatRoomSendLocal(`${sender} gives you the task of typing '${typeTaskText}' ${repetitions} times in a whisper to her.`);
			return true;
		},
		autoCompleter: (argv) => {
			if (argv.length === 1 && typeTaskText) {
				return Command_pickAutocomplete(argv[0], ["cancel"]);
			}
			return [];
		}
	});
}
