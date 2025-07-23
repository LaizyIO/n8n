import type { INodeProperties, IExecuteFunctions } from 'n8n-workflow';
import axios from 'axios';
import {
	getSendAndWaitConfig,
	getSendAndWaitProperties,
} from '../../../utils/sendAndWait/utils';

// Define our custom properties that will be added to the standard send and wait properties
const customProperties: INodeProperties[] = [
	{
		displayName: 'Callback URL',
		name: 'callbackUrl',
		type: 'string',
		default: '',
		required: true,
		description: 'URL to send the callback notification to your app',
	},
	{
		displayName: 'HITL ID',
		name: 'hitlId',
		type: 'string',
		default: '={{ $execution.id }}',
		description: 'Unique identifier for this HITL request (defaults to execution ID)',
	},
];

// Use n8n's getSendAndWaitProperties function like Teams does
export const description: INodeProperties[] = getSendAndWaitProperties(
	customProperties,
	'message',
	[],
	{
		defaultApproveLabel: '✓ Approve',
		defaultDisapproveLabel: '✗ Decline',
	},
);

export async function execute(this: IExecuteFunctions, i: number, _instanceId: string) {
	// Get our custom parameters
	const callbackUrl = this.getNodeParameter('callbackUrl', i, '') as string;
	const hitlId = this.getNodeParameter('hitlId', i, '') as string;
	const items = this.getInputData();
	const responseType = this.getNodeParameter('responseType', i, 'approval') as string;
	
	// Use n8n's getSendAndWaitConfig to get the proper configuration
	const config = getSendAndWaitConfig(this);
	
	// Get form fields information for customForm type (for callback info only)
	let formFields = null;
	if (responseType === 'customForm') {
		const defineForm = this.getNodeParameter('defineForm', i, 'fields') as 'fields' | 'json';
		
		if (defineForm === 'fields') {
			// Get the fields from the collection
			formFields = this.getNodeParameter('formFields.values', i, []) as any[];
		} else {
			// Get JSON definition
			const jsonOutput = this.getNodeParameter('jsonOutput', i, '') as string;
			try {
				formFields = JSON.parse(jsonOutput);
			} catch {
				formFields = [];
			}
		}
	}
	
	// Send callback to app asynchronously (don't wait for it)
	if (callbackUrl) {
		const callbackData = {
			type: 'hitl_request',
			hitlId,
			title: config.title,
			message: config.message,
			resumeUrl: config.url,
			responseType,
			options: config.options,
			formFields: formFields, // For app info only
			itemData: items[i]?.json || {},
			timestamp: new Date().toISOString(),
		};
		
		// Send callback asynchronously without waiting
		axios.post(callbackUrl, callbackData, {
			headers: { 'Content-Type': 'application/json' },
			timeout: 30000,
		}).then(() => {
			console.log('HITL callback sent successfully');
		}).catch((error) => {
			console.error('Failed to send HITL callback:', error.message);
		});
	}
	
	// Return the current item with HITL information - n8n will handle the webhook pause/resume automatically
	const currentItem = items[i]?.json || {};
	
	// Add HITL information to the output
	const hitlOutput = {
		...currentItem,
		hitl: {
			hitlId,
			title: config.title,
			message: config.message,
			resumeUrl: config.url,
			responseType,
			options: config.options,
			formFields: formFields,
			timestamp: new Date().toISOString(),
		},
	};
	
	return hitlOutput;
}
