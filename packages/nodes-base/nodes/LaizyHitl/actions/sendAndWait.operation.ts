import type { INodeProperties, IExecuteFunctions } from 'n8n-workflow';
import { v4 as uuidv4 } from 'uuid';
import { getSendAndWaitConfig, getSendAndWaitProperties } from '../../../utils/sendAndWait/utils';

// Define our custom properties that will be added to the standard send and wait properties
const customProperties: INodeProperties[] = [];

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
	// Use n8n's getSendAndWaitConfig to get the proper configuration
	const config = getSendAndWaitConfig(this);

	const responseType = this.getNodeParameter('responseType', i, 'approval') as string;

	// Generate unique ID for this HITL interaction
	const hitlId = uuidv4();

	// Prepare form fields for customForm
	let formFields: any[] = [];
	if (responseType === 'customForm') {
		const defineForm = this.getNodeParameter('defineForm', i) as string;
		if (defineForm === 'fields') {
			const fields = this.getNodeParameter('formFields.values', i, []) as Array<{
				fieldLabel: string;
				fieldType: string;
				requiredField?: boolean;
			}>;
			formFields = fields.map((field, index) => ({
				...field,
				fieldId: `field-${index}`,
			}));
		}
	}

	console.log('[HITL Node] Initial execution - putting execution to wait for webhook response');

	// Put the execution to wait - n8n will handle the webhook response
	const waitTill = new Date(Date.now() + 3600000); // 1 hour timeout by default
	await this.putExecutionToWait(waitTill);

	// Return only the HITL data in a consistent, minimal structure
	// This ensures the backend always receives the same format regardless of node position
	const hitlData = {
		hitlId,
		title: config.title,
		message: config.message,
		resumeUrl: config.options[0]?.url,
		responseType,
		options: config.options,
		formFields: formFields,
		timestamp: new Date().toISOString(),
	};

	// Always return the hitl data directly, no matter the workflow context
	return [{ json: { hitl: hitlData } }];
}
