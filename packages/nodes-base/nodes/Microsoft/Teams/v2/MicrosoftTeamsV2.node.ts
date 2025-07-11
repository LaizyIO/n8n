import type {
	IExecuteFunctions,
	INodeType,
	INodeTypeDescription,
	INodeTypeBaseDescription,
} from 'n8n-workflow';

import { router } from './actions/router';
import { versionDescription } from './actions/versionDescription';
import { listSearch } from './methods';
import { addDynamicCredentialsProperties } from '../../../../utils/dynamic-credentials';
import { sendAndWaitWebhook } from '../../../../utils/sendAndWait/utils';

export class MicrosoftTeamsV2 implements INodeType {
	description: INodeTypeDescription;

	constructor(baseDescription: INodeTypeBaseDescription) {
		this.description = addDynamicCredentialsProperties({
			...baseDescription,
			...versionDescription,
			usableAsTool: true,
		});
	}

	methods = { listSearch };

	webhook = sendAndWaitWebhook;

	async execute(this: IExecuteFunctions) {
		return await router.call(this);
	}
}
