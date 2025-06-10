import type { INodeProperties, INodeTypeDescription } from 'n8n-workflow';

// Propriétés standard pour les credentials dynamiques
export const dynamicCredentialsProperties: INodeProperties[] = [
	{
		displayName: 'Use Dynamic Credentials',
		name: 'useDynamicCredentials',
		type: 'boolean',
		default: false,
		description: 'Whether to use credentials from a previous node instead of stored credentials',
	},
	{
		displayName: 'Credential Type',
		name: 'credentialType',
		type: 'options',
		displayOptions: {
			show: {
				useDynamicCredentials: [true],
			},
		},
		options: [
			{
				name: 'OAuth2',
				value: 'oauth2',
			},
			{
				name: 'API Key',
				value: 'apiKey',
			},
			{
				name: 'Basic Auth',
				value: 'basic',
			},
		],
		default: 'oauth2',
		description: 'Type of credential to use from the input data',
	},
	// Champs spécifiques pour OAuth2
	{
		displayName: 'Access Token',
		name: 'credentialPath',
		type: 'string',
		displayOptions: {
			show: {
				useDynamicCredentials: [true],
				credentialType: ['oauth2'],
			},
		},
		default: '',
		description: 'Access token for OAuth2 authentication',
	},

	// Champs spécifiques pour API Key
	{
		displayName: 'API Key',
		name: 'credentialPath',
		type: 'string',
		displayOptions: {
			show: {
				useDynamicCredentials: [true],
				credentialType: ['apiKey'],
			},
		},
		default: '',
		description: 'API key for authentication',
	},

	// Champs spécifiques pour Basic Auth - Username
	{
		displayName: 'Username',
		name: 'basicUsername',
		type: 'string',
		displayOptions: {
			show: {
				useDynamicCredentials: [true],
				credentialType: ['basic'],
			},
		},
		default: '',
		description: 'Username for basic authentication',
	},

	// Champs spécifiques pour Basic Auth - Password
	{
		displayName: 'Password',
		name: 'basicPassword',
		type: 'string',
		typeOptions: {
			password: true,
		},
		displayOptions: {
			show: {
				useDynamicCredentials: [true],
				credentialType: ['basic'],
			},
		},
		default: '',
		description: 'Password for basic authentication',
	},
	// Pour les API Keys, nous avons besoin de configurations supplémentaires
	{
		displayName: 'API Key Location',
		name: 'apiKeyLocation',
		type: 'options',
		displayOptions: {
			show: {
				useDynamicCredentials: [true],
				credentialType: ['apiKey'],
			},
		},
		options: [
			{
				name: 'Header',
				value: 'header',
			},
			{
				name: 'Query Parameter',
				value: 'query',
			},
		],
		default: 'header',
		description: 'Where to add the API key in the request',
	},
	{
		displayName: 'API Key Name',
		name: 'apiKeyName',
		type: 'string',
		displayOptions: {
			show: {
				useDynamicCredentials: [true],
				credentialType: ['apiKey'],
			},
		},
		default: 'X-API-Key',
		description: 'Name of the header or query parameter for the API key',
	},
];

// Fonction pour ajouter les propriétés des credentials dynamiques à une description de node existante
export function addDynamicCredentialsProperties(
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
