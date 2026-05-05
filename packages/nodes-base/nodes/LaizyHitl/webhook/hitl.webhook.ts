import { jsonParse, tryToParseJsonToFormFields } from 'n8n-workflow';
import type {
	IWebhookFunctions,
	IWebhookResponseData,
	IDataObject,
	IBinaryKeyData,
	FormFieldsParameter,
} from 'n8n-workflow';
import { rm } from 'fs/promises';
import { resolveRawData } from '../../Form/utils/utils';

// Coerce a raw value (received via multipart/form-data, always a string)
// into the expected JS type based on its fieldType. Mirrors the logic from
// n8n native Form node: see `addFormResponseDataToReturnItem` in
// packages/nodes-base/nodes/Form/utils/utils.ts.
function coerceFieldValue(value: unknown, field: FormFieldsParameter[number]): unknown {
	if (value === null || value === undefined) return null;

	if (field.fieldType === 'html') {
		return value;
	}

	let coerced: unknown = value;

	if (field.fieldType === 'number') {
		coerced = Number(value);
	}
	if (field.fieldType === 'text') {
		coerced = String(value).trim();
	}
	if (
		(field.multiselect || field.fieldType === 'checkbox' || field.fieldType === 'radio') &&
		typeof coerced === 'string'
	) {
		try {
			const parsed = jsonParse(coerced);
			coerced = parsed;
		} catch {
			// Single value submitted as plain string (e.g. multipart "field-5=option 1")
			// Wrap it as array for checkbox / multiselect, keep as string for single radio
			if (field.fieldType === 'checkbox' || field.multiselect) {
				coerced = [coerced];
			}
		}

		if (field.fieldType === 'radio' && Array.isArray(coerced)) {
			coerced = coerced[0];
		}
	}
	if (field.fieldType === 'file' && field.multipleFiles && !Array.isArray(coerced)) {
		coerced = [coerced];
	}

	return coerced;
}

// Retrieve formFields from node parameters so we can coerce types according
// to each field's declared fieldType. Supports both `defineForm: 'fields'`
// (UI editor) and `defineForm: 'json'` (JSON output mode, FEAT-050).
function getFormFieldsForCoercion(context: IWebhookFunctions): FormFieldsParameter {
	try {
		const responseType = context.getNodeParameter('responseType', '') as string;
		if (responseType !== 'customForm') return [];

		const defineForm = context.getNodeParameter('defineForm', 'fields') as string;
		if (defineForm === 'fields') {
			return (context.getNodeParameter('formFields.values', []) as FormFieldsParameter) ?? [];
		}
		if (defineForm === 'json') {
			const jsonOutput = context.getNodeParameter('jsonOutput', '', {
				rawExpressions: true,
			}) as string;
			return tryToParseJsonToFormFields(resolveRawData(context, jsonOutput));
		}
		return [];
	} catch (error) {
		console.warn(
			'[HITL Webhook] Could not load formFields for coercion:',
			(error as Error).message,
		);
		return [];
	}
}

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
		// n8n parses multipart and exposes form fields either at the root of bodyData
		// or wrapped under bodyData.data (when files are attached). Normalize both.
		const sourceData: IDataObject =
			typeof bodyData === 'object' && bodyData && 'data' in bodyData
				? ((bodyData as any).data as IDataObject)
				: (bodyData as IDataObject);

		if (typeof sourceData === 'object' && sourceData) {
			// Form data with field-X pattern or direct object
			const fieldKeys = Object.keys(sourceData).filter((key) => key.startsWith('field-'));

			if (fieldKeys.length > 0) {
				// Check if this is a single field (FreeText) or multiple fields (CustomForm)
				if (fieldKeys.length === 1 && fieldKeys[0] === 'field-0') {
					// Single field FreeText response - no coercion needed
					responseData = { text: (sourceData as any)['field-0'] };
				} else {
					// Multiple fields CustomForm response
					// Load formFields metadata and coerce values to expected types
					const formFields = getFormFieldsForCoercion(this);
					console.log('[HITL Webhook] FormFields loaded for coercion:', formFields.length);

					responseData = {};
					fieldKeys.forEach((key) => {
						const fieldIndex = key.replace('field-', '');
						const numericIndex = Number(fieldIndex);
						const rawValue = (sourceData as any)[key];
						const field = formFields[numericIndex];

						let coercedValue: unknown = rawValue;
						if (field) {
							coercedValue = coerceFieldValue(rawValue, field);
							if (rawValue !== coercedValue) {
								console.log(`[HITL Webhook] Coerced field-${fieldIndex} (${field.fieldType}):`, {
									from: rawValue,
									to: coercedValue,
								});
							}
						}

						responseData[key] = coercedValue as IDataObject[string];
					});
				}
			} else {
				// Direct object without field-X pattern
				responseData = sourceData;
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
