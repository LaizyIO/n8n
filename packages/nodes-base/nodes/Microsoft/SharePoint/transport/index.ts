import type {
	IDataObject,
	IExecuteFunctions,
	IExecuteSingleFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
} from 'n8n-workflow';
import { DynamicCredentialsHelper } from '../../../../utils/dynamic-credentials';

export async function microsoftSharePointApiRequest(
	this: IExecuteFunctions | IExecuteSingleFunctions | ILoadOptionsFunctions,
	method: IHttpRequestMethods,
	endpoint: string,
	body: IDataObject | Buffer = {},
	qs?: IDataObject,
	headers?: IDataObject,
	url?: string,
): Promise<any> {
	// Si nous sommes dans un contexte d'exécution, vérifier les credentials dynamiques
	if ('getInputData' in this) {
		const dynamicCredHelper = new DynamicCredentialsHelper(this as IExecuteFunctions);

		if (dynamicCredHelper.isDynamicCredentialEnabled()) {
			// Pour SharePoint, utiliser l'URL Graph API standard pour les credentials dynamiques
			const options: IHttpRequestOptions = {
				method,
				url: url ?? `https://graph.microsoft.com/v1.0${endpoint}`,
				json: true,
				headers,
				body,
				qs,
			};

			// Appliquer les credentials dynamiques
			const enhancedOptions = dynamicCredHelper.applyDynamicCredentials({
				method,
				uri: options.url,
				json: true,
				headers: options.headers || {},
				body: options.body,
				qs: options.qs,
			}) as any;

			// Convertir pour this.helpers.request
			const httpRequestOptions = {
				...enhancedOptions,
				url: enhancedOptions.uri,
			};
			delete httpRequestOptions.uri;

			return await this.helpers.request!.call(this, httpRequestOptions);
		}
	}

	// Utiliser les credentials standard avec subdomain
	const credentials: { subdomain: string } = await this.getCredentials(
		'microsoftSharePointOAuth2Api',
	);

	const options: IHttpRequestOptions = {
		method,
		url: url ?? `https://${credentials.subdomain}.sharepoint.com/_api/v2.0${endpoint}`,
		json: true,
		headers,
		body,
		qs,
	};

	return await this.helpers.httpRequestWithAuthentication.call(
		this,
		'microsoftSharePointOAuth2Api',
		options,
	);
}
