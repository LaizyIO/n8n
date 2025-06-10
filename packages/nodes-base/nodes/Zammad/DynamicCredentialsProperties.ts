import type { INodeProperties, INodeTypeDescription } from 'n8n-workflow';

// Propriétés pour les credentials dynamiques spécifiques à Zammad
export const dynamicCredentialsProperties: INodeProperties[] = [
	// Option principale pour activer les credentials dynamiques
	{
		displayName: 'Use Dynamic Credentials',
		name: 'useDynamicCredentials',
		type: 'boolean',
		default: false,
		description: 'Whether to use credentials from a previous node instead of stored credentials',
	},

	// Sélecteur de type d'authentification (même que celui du nœud)
	{
		displayName: 'Authentication',
		name: 'dynamicAuthentication',
		type: 'options',
		displayOptions: {
			show: {
				useDynamicCredentials: [true],
			},
		},
		options: [
			{
				name: 'Basic Auth',
				value: 'basicAuth',
			},
			{
				name: 'Token Auth',
				value: 'tokenAuth',
			},
		],
		default: 'tokenAuth',
	},

	// URL de base commune aux deux types
	{
		displayName: 'Base URL',
		name: 'baseUrl',
		type: 'string',
		displayOptions: {
			show: {
				useDynamicCredentials: [true],
			},
		},
		default: '',
		description: 'Base URL of the Zammad instance, e.g. https://your-domain.zammad.com',
		placeholder: 'e.g. https://your-domain.zammad.com or {{ $json.credentials.baseUrl }}',
	},

	// Option pour les certificats non autorisés
	{
		displayName: 'Allow Unauthorized Certificates',
		name: 'allowUnauthorizedCerts',
		type: 'boolean',
		displayOptions: {
			show: {
				useDynamicCredentials: [true],
			},
		},
		default: false,
		description: 'Whether to connect even if SSL certificate is not trusted',
	},

	// Champs pour Basic Auth
	{
		displayName: 'Username',
		name: 'username',
		type: 'string',
		displayOptions: {
			show: {
				useDynamicCredentials: [true],
				dynamicAuthentication: ['basicAuth'],
			},
		},
		default: '',
		description: 'Username for basic authentication',
		placeholder: 'e.g. admin@example.com or {{ $json.credentials.username }}',
	},
	{
		displayName: 'Password',
		name: 'password',
		type: 'string',
		typeOptions: {
			password: true,
		},
		displayOptions: {
			show: {
				useDynamicCredentials: [true],
				dynamicAuthentication: ['basicAuth'],
			},
		},
		default: '',
		description: 'Password for basic authentication',
		placeholder: 'e.g. password123 or {{ $json.credentials.password }}',
	},

	// Champ pour Token Auth
	{
		displayName: 'Access Token',
		name: 'accessToken',
		type: 'string',
		typeOptions: {
			password: true,
		},
		displayOptions: {
			show: {
				useDynamicCredentials: [true],
				dynamicAuthentication: ['tokenAuth'],
			},
		},
		default: '',
		description: 'Access token for token authentication',
		placeholder: 'e.g. abcdef1234567890 or {{ $json.credentials.accessToken }}',
	},
];

/**
 * Ajoute les propriétés de credentials dynamiques au nœud Zammad
 */
export function addDynamicCredentialsToZammad(
	nodeDescription: INodeTypeDescription,
): INodeTypeDescription {
	// Clone the description to avoid modifying the original
	const newDescription: INodeTypeDescription = JSON.parse(JSON.stringify(nodeDescription));

	// Ajouter les propriétés dynamiques au début des propriétés existantes
	newDescription.properties = [
		...dynamicCredentialsProperties,
		...(newDescription.properties || []),
	];

	// Modifier les credentials pour les rendre optionnels (required: false)
	if (newDescription.credentials) {
		newDescription.credentials = newDescription.credentials.map((credential) => {
			return { ...credential, required: false };
		});
	}

	return newDescription;
}
