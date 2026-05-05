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
				responseMode: '={{$parameter["responseMode"]}}',
				responseData: '={{$parameter["responseData"]}}',
				responseBinaryPropertyName: '={{$parameter["responseBinaryPropertyName"]}}',
				path: '={{ $nodeId }}',
				restartWebhook: true,
				isFullPath: true,
			},
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: '={{$parameter["responseMode"]}}',
				responseData: '={{$parameter["responseData"]}}',
				responseBinaryPropertyName: '={{$parameter["responseBinaryPropertyName"]}}',
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
			{
				displayName: 'Respond',
				name: 'responseMode',
				type: 'options',
				options: [
					{
						name: 'When Workflow Finishes',
						value: 'lastNode',
						description: 'Wait for workflow to finish, return result in HTTP response',
					},
				],
				default: 'lastNode',
				description: 'How to respond to the webhook HTTP request',
			},
			{
				displayName: 'Response Data',
				name: 'responseData',
				type: 'options',
				displayOptions: {
					show: {
						responseMode: ['lastNode'],
					},
				},
				options: [
					{
						name: 'First Entry JSON',
						value: 'firstEntryJson',
						description: 'Return JSON data of first workflow result',
					},
					{
						name: 'First Entry Binary',
						value: 'firstEntryBinary',
						description: 'Return binary file from first workflow result',
					},
					{
						name: 'All Entries',
						value: 'allEntries',
						description: 'Return all workflow results as array',
					},
				],
				default: 'firstEntryJson',
				description: 'What data to return in HTTP response',
			},
			{
				displayName: 'Property Name',
				name: 'responseBinaryPropertyName',
				type: 'string',
				required: true,
				default: 'data',
				displayOptions: {
					show: {
						responseData: ['firstEntryBinary'],
					},
				},
				description: 'Name of the binary property to return',
			},
			...sendAndWaitOperation.description,
		],
	};

	webhook = customHitlWebhook;

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		return await router.call(this);
	}
}
