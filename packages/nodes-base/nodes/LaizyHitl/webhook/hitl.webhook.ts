import type {
	IWebhookFunctions,
	IWebhookResponseData,
	IDataObject,
} from 'n8n-workflow';

export async function customHitlWebhook(
	this: IWebhookFunctions,
): Promise<IWebhookResponseData> {
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
			if ('field-0' in bodyData) {
				// FreeText response
				responseData = { text: (bodyData as any)['field-0'] };
			} else {
				// CustomForm response - preserve all fields
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

	// Return standard n8n webhook response
	// n8n will automatically handle responseMode and responseData based on node configuration
	console.log('[HITL Webhook] Returning webhook data to n8n for processing');
	return {
		workflowData: [[{ json: { data: responseData } }]],
	};
}
