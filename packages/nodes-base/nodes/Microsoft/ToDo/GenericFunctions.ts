import type {
	IExecuteFunctions,
	IDataObject,
	ILoadOptionsFunctions,
	JsonObject,
	IHttpRequestMethods,
	IRequestOptions,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';
import { DynamicCredentialsHelper } from '../../../utils/dynamic-credentials';

export async function microsoftApiRequest(
	this: IExecuteFunctions | ILoadOptionsFunctions,
	method: IHttpRequestMethods,
	resource: string,
	body: IDataObject = {},
	qs: IDataObject = {},
	uri?: string,
	_headers: IDataObject = {},
	option: IDataObject = { json: true },
) {
	const options: IRequestOptions = {
		headers: {
			'Content-Type': 'application/json',
		},
		method,
		body,
		qs,
		uri: uri || `https://graph.microsoft.com/v1.0/me${resource}`,
	};
	try {
		Object.assign(options, option);
		if (Object.keys(qs).length === 0) {
			delete options.qs;
		}
		if (Object.keys(body).length === 0) {
			delete options.body;
		}

		// Si nous sommes dans un contexte d'exécution, vérifier les credentials dynamiques
		if ('getInputData' in this) {
			const dynamicCredHelper = new DynamicCredentialsHelper(this as IExecuteFunctions);

			if (dynamicCredHelper.isDynamicCredentialEnabled()) {
				// Appliquer les credentials dynamiques aux options
				const enhancedOptions = dynamicCredHelper.applyDynamicCredentials(
					options,
				) as IRequestOptions;

				// Convertir IRequestOptions en IHttpRequestOptions pour this.helpers.request
				const httpRequestOptions = {
					...enhancedOptions,
					url: enhancedOptions.uri,
				};
				delete httpRequestOptions.uri;

				return await this.helpers.request!.call(this, httpRequestOptions);
			}
		}

		return await this.helpers.requestOAuth2.call(this, 'microsoftToDoOAuth2Api', options);
	} catch (error) {
		throw new NodeApiError(this.getNode(), error as JsonObject);
	}
}

export async function microsoftApiRequestAllItems(
	this: IExecuteFunctions | ILoadOptionsFunctions,
	propertyName: string,
	method: IHttpRequestMethods,
	endpoint: string,
	body: IDataObject = {},
	query: IDataObject = {},
) {
	const returnData: IDataObject[] = [];

	let responseData;
	let uri: string | undefined;
	query.$top = 100;

	do {
		responseData = await microsoftApiRequest.call(this, method, endpoint, body, query, uri);
		uri = responseData['@odata.nextLink'];
		if (uri?.includes('$top')) {
			delete query.$top;
		}
		returnData.push.apply(returnData, responseData[propertyName] as IDataObject[]);
	} while (responseData['@odata.nextLink'] !== undefined);

	return returnData;
}

export async function microsoftApiRequestAllItemsSkip(
	this: IExecuteFunctions,
	propertyName: string,
	method: IHttpRequestMethods,
	endpoint: string,
	body: IDataObject = {},
	query: IDataObject = {},
) {
	const returnData: IDataObject[] = [];

	let responseData;
	query.$top = 100;
	query.$skip = 0;

	do {
		responseData = await microsoftApiRequest.call(this, method, endpoint, body, query);
		query.$skip += query.$top;
		returnData.push.apply(returnData, responseData[propertyName] as IDataObject[]);
	} while (responseData.value.length !== 0);

	return returnData;
}
