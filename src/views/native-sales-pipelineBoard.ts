import { defineView, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS as objects } from 'twenty-sdk/define';
import { NATIVE_SALES } from 'src/constants/native-sales';

export default defineView({universalIdentifier:NATIVE_SALES.pipelineBoard,name:'Funis de vendas',objectUniversalIdentifier:objects.opportunity.universalIdentifier,type:'KANBAN',position:-19,icon:'IconLayoutKanban',mainGroupByFieldMetadataUniversalIdentifier:'c82c6820-3f44-4a52-946f-dd923cc03f74',shouldHideEmptyGroups:true,kanbanColumnWidth:290,kanbanAggregateOperation:'SUM',kanbanAggregateOperationFieldMetadataUniversalIdentifier:objects.opportunity.fields.amount.universalIdentifier,fields:[{universalIdentifier:'ceabd080-27a2-4919-b111-20731b75cae9',fieldMetadataUniversalIdentifier:objects.opportunity.fields.name.universalIdentifier,position:0,isVisible:true,size:180},
{universalIdentifier:'0aff8f35-376b-43ca-9aff-00880b6b847a',fieldMetadataUniversalIdentifier:objects.opportunity.fields.company.universalIdentifier,position:1,isVisible:true,size:180},
{universalIdentifier:'decd0fbe-6ae9-4e9a-82e8-71b161e98260',fieldMetadataUniversalIdentifier:objects.opportunity.fields.pointOfContact.universalIdentifier,position:2,isVisible:false,size:180},
{universalIdentifier:'5df8824b-0cc7-4b64-8c64-62b087f752ae',fieldMetadataUniversalIdentifier:objects.opportunity.fields.owner.universalIdentifier,position:3,isVisible:true,size:180},
{universalIdentifier:'6935076f-99c1-4c7c-922b-7dc4c4cbbf62',fieldMetadataUniversalIdentifier:objects.opportunity.fields.amount.universalIdentifier,position:4,isVisible:true,size:180},
{universalIdentifier:'705ea9bd-d084-425a-9c20-3a276e69f397',fieldMetadataUniversalIdentifier:objects.opportunity.fields.closeDate.universalIdentifier,position:5,isVisible:false,size:180},
{universalIdentifier:'268973e6-6a8d-4e87-b265-d4e13d4bb076',fieldMetadataUniversalIdentifier:'66319b43-c953-44c5-a21d-591b36b76dfb',position:6,isVisible:true,size:180},
{universalIdentifier:'9d0d3ab1-4192-440f-84c3-3badf4c0e5f6',fieldMetadataUniversalIdentifier:'9ff18b50-b15c-475b-b0ed-9e104000a470',position:7,isVisible:true,size:180},
{universalIdentifier:'b87877ab-ad15-4b1c-bb71-23d392b92fac',fieldMetadataUniversalIdentifier:'2f8ee9bf-9b4f-4a61-8f98-aaff48b12890',position:8,isVisible:false,size:180},
{universalIdentifier:'f693d556-c2e0-4eeb-9b5f-bd1e9b64dc37',fieldMetadataUniversalIdentifier:'c82c6820-3f44-4a52-946f-dd923cc03f74',position:9,isVisible:false,size:180},
{universalIdentifier:'96fd3ec2-1fd2-4db6-a438-c20da830da53',fieldMetadataUniversalIdentifier:'4cfc1f93-cd08-4e4b-bec4-fb7dd152edb5',position:10,isVisible:false,size:180},
{universalIdentifier:'13da91f8-b07d-4f62-bc5d-48f68f046a2b',fieldMetadataUniversalIdentifier:'fd10d713-2304-4ac1-82d5-a6eb1a0d6e3d',position:11,isVisible:false,size:180},
{universalIdentifier:'77b658e4-f760-4850-b1a6-1b047a5bb964',fieldMetadataUniversalIdentifier:'627b6d6a-fe73-4c6a-9d80-0d3f8b604253',position:12,isVisible:false,size:180}],sorts:[{universalIdentifier:'a928adbf-8e43-40d3-aee1-b0237624953a',fieldMetadataUniversalIdentifier:objects.opportunity.fields.createdAt.universalIdentifier,direction:'DESC'}]});
