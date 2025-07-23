import type {
	IExecuteFunctions,
	INodeExecutionData,
} from 'n8n-workflow';

import {
	SEND_AND_WAIT_OPERATION,
	NodeOperationError,
} from 'n8n-workflow';

import * as sendAndWait from './sendAndWait.operation';
import { configureWaitTillDate } from '../../../utils/sendAndWait/configureWaitTillDate.util';

export async function router(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
	const items = this.getInputData();
	const returnData: INodeExecutionData[] = [];
	let responseData;

	const operation = this.getNodeParameter('operation', 0);
	const instanceId = this.getInstanceId();

	for (let i = 0; i < items.length; i++) {
		try {
			if (operation === SEND_AND_WAIT_OPERATION) {
				responseData = await sendAndWait.execute.call(this, i, instanceId);
				const waitTill = configureWaitTillDate(this);
				await this.putExecutionToWait(waitTill);
			} else {
				throw new NodeOperationError(
					this.getNode(),
					`The operation "${operation}" is not supported!`,
				);
			}

			const executionData = this.helpers.constructExecutionMetaData(
				this.helpers.returnJsonArray(responseData),
				{ itemData: { item: i } },
			);

			returnData.push(...executionData);
		} catch (error) {
			if (this.continueOnFail()) {
				const executionErrorData = this.helpers.constructExecutionMetaData(
					this.helpers.returnJsonArray({ error: error.message }),
					{ itemData: { item: i } },
				);
				returnData.push(...executionErrorData);
				continue;
			}
			throw error;
		}
	}
	return [returnData];
}
