import { ConditionsLimit, ModuleCategory } from "../constants";
import { registerRule } from "../modules/rules";
import { hookFunction } from "../patching";
import { icon_OwnerList } from "../resources";

export function initRules_bc_relation_control() {
	registerRule("rc_club_owner", {
		name: "Forbid club owner changes",
		icon: icon_OwnerList,
		shortDescription: "relationship control",
		longDescription: "Forbid PLAYER_NAME to leave or get a club owner",
		// Logs are not implemented
		loggable: false,
		// triggerTexts: {
		// 	infoBeep: "You are not allowed to [leave your|get an] owner!",
		// 	attempt_log: "PLAYER_NAME tried to [leave their|get an] owner, which was forbidden.",
		// 	log: "PLAYER_NAME [left their|got an] owner, which was forbidden."
		// },
		defaultLimit: ConditionsLimit.limited,
		load(state) {
			hookFunction("ChatRoomOwnershipOptionIs", 5, (args, next) => {
				const Option = args[0] as string;
				if (state.isEnforced && Option === "CanStartTrial")
					return false;
				return next(args);
			}, ModuleCategory.Rules);
			for (const fun of [
				"ManagementCanBeReleasedOnline",
				"ManagementCanBreakTrialOnline",
				"ManagementCannotBeReleasedOnline",
				"ManagementCanBeReleased",
				"ManagementCannotBeReleased"
			]) {
				hookFunction(fun, 5, (args, next) => {
					return !state.isEnforced && next(args);
				}, ModuleCategory.Rules);
			}
			hookFunction("ManagementCannotBeReleasedExtreme", 5, (args, next) => {
				return state.isEnforced || next(args);
			}, ModuleCategory.Rules);
		}
	});

	registerRule("rc_new_lovers", {
		name: "Forbid getting lovers",
		icon: icon_OwnerList,
		shortDescription: "relationship control",
		longDescription: "Forbid PLAYER_NAME to get a new lover",
		// Logs are not implemented
		loggable: false,
		// triggerTexts: {
		// 	infoBeep: "Due to a rule, you are not allowed to get a new lover!",
		// 	attempt_log: "PLAYER_NAME tried to get a new lover, TARGET_PLAYER, which was forbidden",
		// 	log: "PLAYER_NAME got a new lover, TARGET_PLAYER, which was forbidden"
		// },
		defaultLimit: ConditionsLimit.limited,
		load(state) {
			hookFunction("ChatRoomLovershipOptionIs", 5, (args, next) => {
				const Option = args[0] as string;
				if (state.isEnforced && (Option === "CanOfferBeginDating" || Option === "CanBeginDating"))
					return false;
				return next(args);
			}, ModuleCategory.Rules);
		}
	});

	registerRule("rc_leave_lovers", {
		name: "Forbid leaving lovers",
		icon: icon_OwnerList,
		shortDescription: "relationship control",
		longDescription: "Forbid PLAYER_NAME to leave any of their lovers",
		// Logs are not implemented
		loggable: false,
		// triggerTexts: {
		// 	infoBeep: "Due to a rule, you are not allowed to leave your lover!",
		// 	attempt_log: "PLAYER_NAME tried to leave their lover, TARGET_PLAYER, which was forbidden",
		// 	log: "PLAYER_NAME left their lover, TARGET_PLAYER, which was forbidden"
		// },
		defaultLimit: ConditionsLimit.limited,
		load(state) {
			for (const fun of [
				"ManagementCanBreakDatingLoverOnline",
				"ManagementCanBreakUpLoverOnline"
			]) {
				hookFunction(fun, 5, (args, next) => {
					return !state.isEnforced && next(args);
				}, ModuleCategory.Rules);
			}
		}
	});

	registerRule("rc_new_subs", {
		name: "Forbid getting subs",
		icon: icon_OwnerList,
		shortDescription: "relationship control",
		longDescription: "Forbid PLAYER_NAME to collar a new submissive",
		// Logs are not implemented
		loggable: false,
		// triggerTexts: {
		// 	infoBeep: "Due to a rule, you are not allowed to own a new submissive!",
		// 	attempt_log: "PLAYER_NAME tried to collar a new sub, TARGET_PLAYER, which was forbidden",
		// 	log: "PLAYER_NAME collared a new sub, TARGET_PLAYER, which was forbidden"
		// },
		defaultLimit: ConditionsLimit.limited,
		load(state) {
			hookFunction("ChatRoomOwnershipOptionIs", 5, (args, next) => {
				const Option = args[0] as string;
				if (state.isEnforced && Option === "Propose")
					return false;
				return next(args);
			}, ModuleCategory.Rules);
		}
	});

	registerRule("rc_leave_subs", {
		name: "Forbid disowning subs",
		icon: icon_OwnerList,
		shortDescription: "relationship control",
		longDescription: "Forbid PLAYER_NAME to let go of any of their subs",
		// Logs are not implemented
		loggable: false,
		// triggerTexts: {
		// 	infoBeep: "Due to a rule, you are not allowed to let go of any of your submissive!",
		// 	attempt_log: "PLAYER_NAME tried to let go of their sub, TARGET_PLAYER, which was forbidden",
		// 	log: "PLAYER_NAME let go of their sub, TARGET_PLAYER, which was forbidden"
		// },
		defaultLimit: ConditionsLimit.limited,
		load(state) {
			hookFunction("ChatRoomIsOwnedByPlayer", 5, (args, next) => {
				return !state.isEnforced && next(args);
			}, ModuleCategory.Rules);
		}
	});
}
