import type { IExecuteFunctions, IRequestOptions, IDataObject } from 'n8n-workflow';

/**
 * Helper spécifique pour les credentials dynamiques du nœud Zammad
 */
export class ZammadDynamicCredentialsHelper {
	constructor(private readonly execFunctions: IExecuteFunctions) {}

	/**
	 * Vérifie si les credentials dynamiques sont activées
	 */
	isDynamicCredentialEnabled(itemIndex: number = 0): boolean {
		try {
			const useZammadDynamicCredentials = this.execFunctions.getNodeParameter(
				'useZammadDynamicCredentials',
				itemIndex,
			) as boolean;
			return useZammadDynamicCredentials === true;
		} catch (error) {
			return false;
		}
	}

	/**
	 * Obtient le type d'authentification sélectionné (basic ou token)
	 */
	getAuthenticationType(itemIndex: number = 0): 'basicAuth' | 'tokenAuth' {
		return this.execFunctions.getNodeParameter('authentication', itemIndex) as
			| 'basicAuth'
			| 'tokenAuth';
	}

	/**
	 * Obtient les credentials dynamiques en fonction du type d'authentification
	 */
	getDynamicCredentials(itemIndex: number = 0): IDataObject {
		if (!this.isDynamicCredentialEnabled(itemIndex)) {
			throw new Error('Dynamic credentials are not enabled for this node');
		}

		try {
			const authenticationType = this.getAuthenticationType(itemIndex);

			// Base URL commune aux deux types d'authentification
			const baseUrl = this.execFunctions.getNodeParameter('baseUrl', itemIndex, '') as string;
			const allowUnauthorizedCerts = this.execFunctions.getNodeParameter(
				'allowUnauthorizedCerts',
				itemIndex,
				false,
			) as boolean;

			// Propriétés de base communes
			const credentials: IDataObject = {
				baseUrl,
				allowUnauthorizedCerts,
			};

			if (authenticationType === 'basicAuth') {
				// Basic Auth
				const username = this.execFunctions.getNodeParameter('username', itemIndex) as string;
				const password = this.execFunctions.getNodeParameter('password', itemIndex) as string;

				credentials.username = username;
				credentials.password = password;
			} else {
				// Token Auth
				const accessToken = this.execFunctions.getNodeParameter('accessToken', itemIndex) as string;
				credentials.accessToken = accessToken;
			}

			return credentials;
		} catch (error) {
			throw new Error(`Failed to get dynamic credentials: ${error.message}`);
		}
	}

	/**
	 * Applique les credentials dynamiques aux options de requête
	 */
	applyDynamicCredentials(options: IRequestOptions, itemIndex: number = 0): IRequestOptions {
		if (!this.isDynamicCredentialEnabled(itemIndex)) {
			return options;
		}

		const credentials = this.getDynamicCredentials(itemIndex);
		const authenticationType = this.getAuthenticationType(itemIndex);

		// Copie des options pour ne pas modifier l'original
		const newOptions = { ...options };

		// Définir l'URI avec la baseUrl
		if (credentials.baseUrl && typeof credentials.baseUrl === 'string') {
			// Traiter la baseUrl pour enlever le slash final si présent
			const baseUrl = credentials.baseUrl.endsWith('/')
				? credentials.baseUrl.substr(0, credentials.baseUrl.length - 1)
				: credentials.baseUrl;

			// Extraire le endpoint de l'URI existante (la partie après /api/v1)
			let endpoint = '';
			if (newOptions.uri && typeof newOptions.uri === 'string') {
				const match = newOptions.uri.match(/\/api\/v1(.*)$/);
				if (match && match[1]) {
					endpoint = match[1];
				}
			}

			newOptions.uri = `${baseUrl}/api/v1${endpoint}`;
		}

		// Configurer l'authentification selon le type
		if (authenticationType === 'basicAuth') {
			if (credentials.username && credentials.password) {
				newOptions.auth = {
					user: credentials.username as string,
					pass: credentials.password as string,
				};
			}
		} else {
			// Token Auth
			if (credentials.accessToken) {
				newOptions.headers = newOptions.headers || {};
				newOptions.headers.Authorization = `Token token=${credentials.accessToken}`;
			}
		}

		// Option pour les certificats non autorisés
		if (credentials.allowUnauthorizedCerts !== undefined) {
			newOptions.rejectUnauthorized = !credentials.allowUnauthorizedCerts;
		}

		return newOptions;
	}
}
