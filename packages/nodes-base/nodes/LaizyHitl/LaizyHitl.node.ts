import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, SEND_AND_WAIT_OPERATION } from 'n8n-workflow';

import { router } from './actions';

import * as sendAndWaitOperation from './actions/sendAndWait.operation';
import { customHitlWebhook } from './webhook/hitl.webhook';

export class LaizyHitl implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Laizy HITL',
		name: 'laizyHitl',
		icon: 'fa:user-check',
		group: ['output'],
		version: 1,
		subtitle: '={{ $parameter["operation"] + ": " + $parameter["resource"] }}',
		description: 'Human-in-the-loop node that pauses workflow and sends callback to your app',
		defaults: {
			name: 'Laizy HITL',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'GET',
				responseMode: 'lastNode',
				responseData: 'firstEntryJson',
				path: '={{ $nodeId }}',
				restartWebhook: true,
				isFullPath: true,
			},
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'lastNode',
				responseData: 'firstEntryJson',
				path: '={{ $nodeId }}',
				restartWebhook: true,
				isFullPath: true,
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Message',
						value: 'message',
					},
				],
				default: 'message',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['message'],
					},
				},
				options: [
					{
						name: 'Send and Wait for Response',
						value: SEND_AND_WAIT_OPERATION,
						description: 'Send a callback and wait for human response',
						action: 'Send message and wait for human response',
					},
				],
				default: SEND_AND_WAIT_OPERATION,
			},
			...sendAndWaitOperation.description,
		],
	};

	webhook = customHitlWebhook;

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		return await router.call(this);
	}
}
