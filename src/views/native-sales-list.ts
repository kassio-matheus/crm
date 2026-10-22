import { defineView, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS as objects } from 'twenty-sdk/define';
import { NATIVE_SALES } from 'src/constants/native-sales';

export default defineView({universalIdentifier:NATIVE_SALES.list,name:'Lista de negociações',objectUniversalIdentifier:objects.opportunity.universalIdentifier,type:'TABLE',position:-18,icon:'IconList',fields:[{universalIdentifier:'4fb5ee68-e347-41a6-b65e-7387aa26c4eb',fieldMetadataUniversalIdentifier:objects.opportunity.fields.name.universalIdentifier,position:0,isVisible:true,size:180},
{universalIdentifier:'12f1e4f6-e4a0-4c2b-959b-51f938945c64',fieldMetadataUniversalIdentifier:objects.opportunity.fields.company.universalIdentifier,position:1,isVisible:true,size:180},
{universalIdentifier:'6478694b-ca26-48c2-9eba-33c278d82d17',fieldMetadataUniversalIdentifier:objects.opportunity.fields.pointOfContact.universalIdentifier,position:2,isVisible:true,size:180},
{universalIdentifier:'852b5c33-640c-4865-8b9a-24965f4adade',fieldMetadataUniversalIdentifier:objects.opportunity.fields.owner.universalIdentifier,position:3,isVisible:true,size:180},
{universalIdentifier:'c5da9f1b-2817-4b2d-a2bb-d5bf40548a13',fieldMetadataUniversalIdentifier:objects.opportunity.fields.amount.universalIdentifier,position:4,isVisible:true,size:180},
{universalIdentifier:'66d6ef54-0714-4098-af8a-400e2e6ef301',fieldMetadataUniversalIdentifier:objects.opportunity.fields.closeDate.universalIdentifier,position:5,isVisible:true,size:180},
{universalIdentifier:'e5ecbb95-dfb6-4cbb-b74a-3a2056e36e37',fieldMetadataUniversalIdentifier:'66319b43-c953-44c5-a21d-591b36b76dfb',position:6,isVisible:true,size:180},
{universalIdentifier:'8a932d36-667f-406a-8897-1ceb8ef96329',fieldMetadataUniversalIdentifier:'9ff18b50-b15c-475b-b0ed-9e104000a470',position:7,isVisible:true,size:180},
{universalIdentifier:'b3f581c2-ed62-4031-b41c-ebe538ca944f',fieldMetadataUniversalIdentifier:'2f8ee9bf-9b4f-4a61-8f98-aaff48b12890',position:8,isVisible:true,size:180},
{universalIdentifier:'3b2a0e8d-a120-44b4-8407-838f07b9bdb8',fieldMetadataUniversalIdentifier:'c82c6820-3f44-4a52-946f-dd923cc03f74',position:9,isVisible:true,size:180},
{universalIdentifier:'7e81c6bb-21eb-4499-951f-6c1d2a841639',fieldMetadataUniversalIdentifier:'4cfc1f93-cd08-4e4b-bec4-fb7dd152edb5',position:10,isVisible:true,size:180},
{universalIdentifier:'8dd114e5-a3f3-42bc-9309-efc31ecddbed',fieldMetadataUniversalIdentifier:'fd10d713-2304-4ac1-82d5-a6eb1a0d6e3d',position:11,isVisible:true,size:180},
{universalIdentifier:'09b43a85-8b34-4e55-9a28-06848f293158',fieldMetadataUniversalIdentifier:'627b6d6a-fe73-4c6a-9d80-0d3f8b604253',position:12,isVisible:true,size:180}],sorts:[{universalIdentifier:'00036580-9c0a-4310-aae4-61350f2c5f84',fieldMetadataUniversalIdentifier:objects.opportunity.fields.createdAt.universalIdentifier,direction:'DESC'}]});
