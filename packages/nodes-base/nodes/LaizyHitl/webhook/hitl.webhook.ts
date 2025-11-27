import type {
	IWebhookFunctions,
	IWebhookResponseData,
	IDataObject,
	IBinaryKeyData,
} from 'n8n-workflow';
import { rm } from 'fs/promises';

export async function customHitlWebhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
	console.log('[HITL Webhook] Processing HITL webhook response');

	const req = this.getRequestObject();
	const bodyData = this.getBodyData();
	const queryData = this.getQueryData();

	console.log('[HITL Webhook] Request method:', req.method);
	console.log('[HITL Webhook] Body data:', bodyData);
	console.log('[HITL Webhook] Query data:', queryData);

	// Extract response data based on request type (following sendAndWaitWebhook patterns)
	let responseData: IDataObject = {};

	if (req.method === 'GET' && Object.keys(queryData).length > 0) {
		// Approval type: ?approved=true/false
		if ('approved' in queryData) {
			responseData = { approved: queryData.approved === 'true' };
		} else {
			responseData = queryData as IDataObject;
		}
	} else if (req.method === 'POST' && bodyData) {
		// Form submission: field-0, field-1, etc. or complex form data
		if (typeof bodyData === 'object' && 'data' in bodyData) {
			// Already processed multipart data
			responseData = (bodyData as any).data;
		} else if (typeof bodyData === 'object') {
			// Form data with field-X pattern or direct object
			const fieldKeys = Object.keys(bodyData).filter((key) => key.startsWith('field-'));

			if (fieldKeys.length > 0) {
				// Check if this is a single field (FreeText) or multiple fields (CustomForm)
				if (fieldKeys.length === 1 && fieldKeys[0] === 'field-0') {
					// Single field FreeText response
					responseData = { text: (bodyData as any)['field-0'] };
				} else {
					// Multiple fields CustomForm response - preserve all field data
					responseData = {};
					fieldKeys.forEach((key) => {
						const fieldIndex = key.replace('field-', '');
						responseData[`field_${fieldIndex}`] = (bodyData as any)[key];
					});
				}
			} else {
				// Direct object without field-X pattern
				responseData = bodyData as IDataObject;
			}
		} else {
			responseData = { data: bodyData };
		}
	} else {
		// Fallback
		responseData = { message: 'HITL response received' };
	}

	console.log('[HITL Webhook] Processed response data:', JSON.stringify(responseData, null, 2));

	// Process binary files if present in multipart/form-data request
	let binaryData: IBinaryKeyData = {};

	if (typeof bodyData === 'object' && 'files' in bodyData) {
		console.log('[HITL Webhook] Processing uploaded files');
		const files = (bodyData as any).files;

		for (const key of Object.keys(files)) {
			const file = files[key];
			console.log(`[HITL Webhook] Processing file ${key}:`, {
				originalFilename: file.originalFilename,
				mimetype: file.mimetype,
				size: file.size,
			});

			// Copy file to n8n's binary data storage
			binaryData[key] = await this.nodeHelpers.copyBinaryFile(
				file.filepath,
				file.originalFilename ?? file.newFilename,
				file.mimetype,
			);

			// Clean up temporary file
			await rm(file.filepath, { force: true });
			console.log(`[HITL Webhook] File ${key} processed and temp file cleaned`);
		}

		console.log(`[HITL Webhook] Total files processed: ${Object.keys(binaryData).length}`);
	}

	// Return standard n8n webhook response
	// n8n will automatically handle responseMode and responseData based on node configuration
	console.log('[HITL Webhook] Returning webhook data to n8n for processing');
	return {
		workflowData: [
			[
				{
					json: { data: responseData },
					binary: Object.keys(binaryData).length > 0 ? binaryData : undefined,
				},
			],
		],
	};
}
