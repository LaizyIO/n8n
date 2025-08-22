import type {
	IExecuteFunctions,
	IDataObject,
	JsonObject,
	IRequestOptions,
	IHttpRequestMethods,
} from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';
import { DynamicCredentialsHelper } from '../../../utils/dynamic-credentials';

export async function msGraphSecurityApiRequest(
	this: IExecuteFunctions,
	method: IHttpRequestMethods,
	endpoint: string,
	body: IDataObject = {},
	qs: IDataObject = {},
	headers: IDataObject = {},
) {
	// Vérifier les credentials dynamiques d'abord
	const dynamicCredHelper = new DynamicCredentialsHelper(this);

	if (dynamicCredHelper.isDynamicCredentialEnabled()) {
		// Utiliser les credentials dynamiques
		const options: IRequestOptions = {
			method,
			body,
			qs,
			uri: `https://graph.microsoft.com/v1.0/security${endpoint}`,
			json: true,
			headers: {},
		};

		if (!Object.keys(body).length) {
			delete options.body;
		}

		if (!Object.keys(qs).length) {
			delete options.qs;
		}

		if (Object.keys(headers).length) {
			options.headers = { ...options.headers, ...headers };
		}

		// Appliquer les credentials dynamiques
		const enhancedOptions = dynamicCredHelper.applyDynamicCredentials(options) as IRequestOptions;

		// Convertir pour this.helpers.request
		const httpRequestOptions = {
			...enhancedOptions,
			url: enhancedOptions.uri,
		};
		delete httpRequestOptions.uri;

		return await this.helpers.request(httpRequestOptions);
	}

	// Utiliser les credentials OAuth2 standard
	const {
		oauthTokenData: { access_token },
	} = await this.getCredentials<{
		oauthTokenData: {
			access_token: string;
		};
	}>('microsoftGraphSecurityOAuth2Api');

	const options: IRequestOptions = {
		headers: {
			Authorization: `Bearer ${access_token}`,
		},
		method,
		body,
		qs,
		uri: `https://graph.microsoft.com/v1.0/security${endpoint}`,
		json: true,
	};

	if (!Object.keys(body).length) {
		delete options.body;
	}

	if (!Object.keys(qs).length) {
		delete options.qs;
	}

	if (Object.keys(headers).length) {
		options.headers = { ...options.headers, ...headers };
	}

	try {
		return await this.helpers.request(options);
	} catch (error) {
		const nestedMessage = error?.error?.error?.message;

		if (nestedMessage.startsWith('{"')) {
			error = JSON.parse(nestedMessage as string);
		}

		if (nestedMessage.startsWith('Http request failed with statusCode=BadRequest')) {
			error.error.error.message = 'Request failed with bad request';
		} else if (nestedMessage.startsWith('Http request failed with')) {
			const stringified = nestedMessage.split(': ').pop();
			if (stringified) {
				error = JSON.parse(stringified as string);
			}
		}

		if (['Invalid filter clause', 'Invalid ODATA query filter'].includes(nestedMessage as string)) {
			error.error.error.message +=
				' - Please check that your query parameter syntax is correct: https://docs.microsoft.com/en-us/graph/query-parameters#filter-parameter';
		}

		throw new NodeApiError(this.getNode(), error as JsonObject);
	}
}

export function tolerateDoubleQuotes(filterQueryParameter: string) {
	return filterQueryParameter.replace(/"/g, "'");
}

export function throwOnEmptyUpdate(this: IExecuteFunctions) {
	throw new NodeOperationError(this.getNode(), 'Please enter at least one field to update');
}
