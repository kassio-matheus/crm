import { defineView, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS as objects } from 'twenty-sdk/define';
import { NATIVE_SALES } from 'src/constants/native-sales';

export default defineView({universalIdentifier:NATIVE_SALES.board,name:'Negociações',objectUniversalIdentifier:objects.opportunity.universalIdentifier,type:'KANBAN',position:-20,icon:'IconLayoutKanban',mainGroupByFieldMetadataUniversalIdentifier:objects.opportunity.fields.stage.universalIdentifier,shouldHideEmptyGroups:false,kanbanColumnWidth:290,kanbanAggregateOperation:'SUM',kanbanAggregateOperationFieldMetadataUniversalIdentifier:objects.opportunity.fields.amount.universalIdentifier,fields:[{universalIdentifier:'1363759b-0daa-48ca-bd9d-b64d1e4a86d7',fieldMetadataUniversalIdentifier:objects.opportunity.fields.name.universalIdentifier,position:0,isVisible:true,size:180},
{universalIdentifier:'0c6b1000-e975-4a3b-b645-d156c892edc2',fieldMetadataUniversalIdentifier:objects.opportunity.fields.company.universalIdentifier,position:1,isVisible:true,size:180},
{universalIdentifier:'b4ca8bc9-5ffc-497a-8fb6-0f88999bf314',fieldMetadataUniversalIdentifier:objects.opportunity.fields.pointOfContact.universalIdentifier,position:2,isVisible:false,size:180},
{universalIdentifier:'49c8761f-9595-44a8-be13-4756ca085676',fieldMetadataUniversalIdentifier:objects.opportunity.fields.owner.universalIdentifier,position:3,isVisible:true,size:180},
{universalIdentifier:'ad413f5b-6217-4dfa-9693-10c4e44f2255',fieldMetadataUniversalIdentifier:objects.opportunity.fields.amount.universalIdentifier,position:4,isVisible:true,size:180},
{universalIdentifier:'7bddfd7b-ad18-4b57-a813-37e1e48bf24d',fieldMetadataUniversalIdentifier:objects.opportunity.fields.closeDate.universalIdentifier,position:5,isVisible:false,size:180},
{universalIdentifier:'e5cf43a2-7797-4d67-ab55-2270b52622b2',fieldMetadataUniversalIdentifier:'66319b43-c953-44c5-a21d-591b36b76dfb',position:6,isVisible:true,size:180},
{universalIdentifier:'f240b9ba-9b7a-40c3-ab61-17870d6593cd',fieldMetadataUniversalIdentifier:'9ff18b50-b15c-475b-b0ed-9e104000a470',position:7,isVisible:true,size:180},
{universalIdentifier:'62a810ff-e576-4ced-83d1-6bbdf9412755',fieldMetadataUniversalIdentifier:'2f8ee9bf-9b4f-4a61-8f98-aaff48b12890',position:8,isVisible:false,size:180},
{universalIdentifier:'a8368e88-3171-4fb0-a7bb-5925f4d23f1c',fieldMetadataUniversalIdentifier:'c82c6820-3f44-4a52-946f-dd923cc03f74',position:9,isVisible:false,size:180},
{universalIdentifier:'20414f57-0afd-45b9-a222-4e267549e5a6',fieldMetadataUniversalIdentifier:'4cfc1f93-cd08-4e4b-bec4-fb7dd152edb5',position:10,isVisible:false,size:180},
{universalIdentifier:'331bbad4-6eb1-4a51-89ee-a312be78da8b',fieldMetadataUniversalIdentifier:'fd10d713-2304-4ac1-82d5-a6eb1a0d6e3d',position:11,isVisible:false,size:180},
{universalIdentifier:'9a1d0cf9-bffa-4543-9e38-2f1d77a01bcb',fieldMetadataUniversalIdentifier:'627b6d6a-fe73-4c6a-9d80-0d3f8b604253',position:12,isVisible:false,size:180}],sorts:[{universalIdentifier:'0548824f-b0c6-48d1-bd41-1d00f55f7076',fieldMetadataUniversalIdentifier:objects.opportunity.fields.createdAt.universalIdentifier,direction:'DESC'}]});
