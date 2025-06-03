import type {
	IExecuteFunctions,
	IDataObject,
	IHttpRequestOptions,
	IRequestOptions,
} from 'n8n-workflow';

/**
 * DynamicCredentialsHelper
 * Cette classe fournit des fonctionnalités pour gérer les credentials dynamiques
 * Elle peut être utilisée comme un proxy pour remplacer n'importe quel type de credential standard
 */
export class DynamicCredentialsHelper {
	constructor(private readonly execFunctions: IExecuteFunctions) {}

	/**
	 * Crée un proxy qui intercepte les appels de getCredentials d'un nœud
	 * Ce proxy vérifie si les credentials dynamiques sont activées et, si c'est le cas,
	 * retourne les credentials dynamiques au lieu des credentials standards
	 */
	static createCredentialsProxy<T extends object>(
		originalMethod: Function,
		execFunctions: IExecuteFunctions,
	): Function {
		return function (this: any, ...args: any[]): any {
			try {
				// Vérifier si les credentials dynamiques sont activées
				const useDynamicCredentials = execFunctions.getNodeParameter(
					'useDynamicCredentials',
					0,
					false,
				) as boolean;

				if (useDynamicCredentials) {
					// Instancier le helper pour accéder aux méthodes
					const helper = new DynamicCredentialsHelper(execFunctions);
					// Retourner les credentials dynamiques à la place
					return Promise.resolve(helper.getDynamicCredentials(0) as unknown as T);
				} else {
					// Utiliser la méthode d'origine pour obtenir les credentials standards
					return originalMethod.apply(this, args);
				}
			} catch (error) {
				// Si une erreur se produit (par exemple, le paramètre n'existe pas), continuer avec les credentials standards
				return originalMethod.apply(this, args);
			}
		};
	}

	/**
	 * Enveloppe la méthode execute d'un nœud pour intercepter les appels aux credentials
	 * Peut être appliquée à n'importe quel type de nœud pour ajouter des credentials dynamiques
	 */
	static wrapNodeExecute(originalExecute: Function): Function {
		return function (this: IExecuteFunctions, ...args: any[]): any {
			// Remplacer la méthode getCredentials par notre proxy
			const originalGetCredentials = this.getCredentials;
			// Utiliser as any pour contourner les vérifications de type - ce sera géré correctement au runtime
			(this as any).getCredentials = DynamicCredentialsHelper.createCredentialsProxy(
				originalGetCredentials,
				this,
			);

			// Exécuter la méthode d'origine avec notre proxy en place
			return originalExecute.apply(this, args);
		};
	}

	/**
	 * Vérifie si les credentials dynamiques sont activés pour ce node
	 */
	isDynamicCredentialEnabled(itemIndex: number = 0): boolean {
		try {
			const useDynamicCredentials = this.execFunctions.getNodeParameter(
				'useDynamicCredentials',
				itemIndex,
			) as boolean;
			return useDynamicCredentials === true;
		} catch (error) {
			return false;
		}
	}

	/**
	 * Récupère les credentials dynamiques depuis les données d'entrée
	 */
	getDynamicCredentials(itemIndex: number = 0): IDataObject {
		if (!this.isDynamicCredentialEnabled(itemIndex)) {
			throw new Error('Dynamic credentials are not enabled for this node');
		}

		try {
			const credentialType = this.execFunctions.getNodeParameter(
				'credentialType',
				itemIndex,
			) as string;

			// Créer l'objet credentials selon le type d'authentification
			if (credentialType === 'basic') {
				// Pour Basic Auth, nous avons deux champs distincts
				const username = this.execFunctions.getNodeParameter('basicUsername', itemIndex) as string;
				const password = this.execFunctions.getNodeParameter('basicPassword', itemIndex) as string;

				return {
					username,
					password,
				};
			} else {
				// Pour OAuth2 et API Key, nous avons un seul champ
				const tokenValue = this.execFunctions.getNodeParameter(
					'credentialPath',
					itemIndex,
				) as string;

				// Créer l'objet selon le type
				if (credentialType === 'oauth2') {
					return { accessToken: tokenValue };
				} else if (credentialType === 'apiKey') {
					return { apiKey: tokenValue };
				}
			}

			throw new Error(`Unsupported credential type: ${credentialType}`);
		} catch (error) {
			throw new Error(`Failed to get dynamic credentials: ${error.message}`);
		}
	}

	/**
	 * Applique les credentials dynamiques aux options de requête
	 */
	applyDynamicCredentials(
		options: IRequestOptions | IHttpRequestOptions,
		itemIndex: number = 0,
	): IRequestOptions | IHttpRequestOptions {
		if (!this.isDynamicCredentialEnabled(itemIndex)) {
			return options;
		}

		const credentials = this.getDynamicCredentials(itemIndex);
		const credentialType = this.execFunctions.getNodeParameter(
			'credentialType',
			itemIndex,
		) as string;

		// Copie des options pour ne pas modifier l'original
		const newOptions = { ...options };
		newOptions.headers = { ...newOptions.headers };

		switch (credentialType) {
			case 'oauth2':
				// credentials contient déjà { accessToken: 'valeur' }
				newOptions.headers.Authorization = `Bearer ${credentials.accessToken}`;
				break;

			case 'apiKey':
				// credentials contient déjà { apiKey: 'valeur' }
				const location = this.execFunctions.getNodeParameter(
					'apiKeyLocation',
					itemIndex,
					'header',
				) as string;
				const keyName = this.execFunctions.getNodeParameter(
					'apiKeyName',
					itemIndex,
					'X-API-Key',
				) as string;

				if (location === 'header') {
					newOptions.headers[keyName] = credentials.apiKey;
				} else if (location === 'query') {
					newOptions.qs = newOptions.qs || {};
					newOptions.qs[keyName] = credentials.apiKey;
				}
				break;

			case 'basic':
				// credentials contient déjà { username: 'user', password: 'pass' }
				const auth = Buffer.from(`${credentials.username}:${credentials.password}`).toString(
					'base64',
				);
				newOptions.headers.Authorization = `Basic ${auth}`;
				break;

			default:
				throw new Error(`Unsupported credential type: ${credentialType}`);
		}

		return newOptions;
	}
}
