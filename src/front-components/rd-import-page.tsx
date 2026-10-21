import { defineFrontComponent } from 'twenty-sdk/define';

// React component - implement your UI here
const Component = () => {
  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>My new component!</h1>
      <p>This is your front component: rd-import-page</p>
    </div>
  );
};

export default defineFrontComponent({
  universalIdentifier: 'd5ada24d-095d-4aae-b2b8-584745427bff',
  name: 'rd-import-page',
  description: 'Add a description for your front component',
  component: Component,
});
