import { ArrowRight, ArrowDown, RotateCcw } from 'lucide-react';

interface FlowNode {
  id: string;
  label: string;
  type: 'screen' | 'action' | 'decision';
  position: { x: number; y: number };
  size: { width: number; height: number };
}

interface FlowConnection {
  from: string;
  to: string;
  label?: string;
  type: 'primary' | 'secondary' | 'back';
}

export function FlowDiagram() {
  const nodes: FlowNode[] = [
    {
      id: 'login',
      label: 'Login Screen',
      type: 'screen',
      position: { x: 300, y: 50 },
      size: { width: 160, height: 80 }
    },
    {
      id: 'main-app',
      label: 'Main App\n(with Navigation)',
      type: 'screen',
      position: { x: 250, y: 180 },
      size: { width: 260, height: 100 }
    },
    {
      id: 'report',
      label: 'Report Ghost\nScreen',
      type: 'screen',
      position: { x: 50, y: 350 },
      size: { width: 140, height: 80 }
    },
    {
      id: 'browse',
      label: 'Browse Ghosts\nScreen',
      type: 'screen',
      position: { x: 250, y: 350 },
      size: { width: 140, height: 80 }
    },
    {
      id: 'profile',
      label: 'User Profile\nScreen',
      type: 'screen',
      position: { x: 450, y: 350 },
      size: { width: 140, height: 80 }
    },
    {
      id: 'edit-sighting',
      label: 'Edit Sighting\nDialog',
      type: 'action',
      position: { x: 650, y: 350 },
      size: { width: 140, height: 80 }
    }
  ];

  const connections: FlowConnection[] = [
    { from: 'login', to: 'main-app', label: 'Login Success', type: 'primary' },
    { from: 'main-app', to: 'report', label: 'Navigate to Report', type: 'secondary' },
    { from: 'main-app', to: 'browse', label: 'Navigate to Browse', type: 'secondary' },
    { from: 'main-app', to: 'profile', label: 'Navigate to Profile', type: 'secondary' },
    { from: 'profile', to: 'edit-sighting', label: 'Edit/Delete', type: 'secondary' },
    { from: 'main-app', to: 'login', label: 'Logout', type: 'back' }
  ];

  const getNodeById = (id: string) => nodes.find(node => node.id === id);

  const renderConnection = (connection: FlowConnection, index: number) => {
    const fromNode = getNodeById(connection.from);
    const toNode = getNodeById(connection.to);
    
    if (!fromNode || !toNode) return null;

    const startX = fromNode.position.x + fromNode.size.width / 2;
    const startY = fromNode.position.y + fromNode.size.height;
    const endX = toNode.position.x + toNode.size.width / 2;
    const endY = toNode.position.y;

    const strokeColor = {
      primary: '#030213',
      secondary: '#717182',
      back: '#d4183d'
    }[connection.type];

    const strokeWidth = connection.type === 'primary' ? 3 : 2;

    return (
      <g key={`connection-${index}`}>
        <defs>
          <marker
            id={`arrowhead-${connection.type}`}
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon
              points="0 0, 10 3.5, 0 7"
              fill={strokeColor}
            />
          </marker>
        </defs>
        
        <path
          d={`M ${startX} ${startY} L ${endX} ${endY}`}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          fill="none"
          markerEnd={`url(#arrowhead-${connection.type})`}
        />
        
        {connection.label && (
          <text
            x={(startX + endX) / 2}
            y={(startY + endY) / 2 - 10}
            textAnchor="middle"
            className="fill-muted-foreground text-sm"
          >
            {connection.label}
          </text>
        )}
      </g>
    );
  };

  const renderNode = (node: FlowNode) => {
    const bgColor = {
      screen: '#ffffff',
      action: '#e9ebef',
      decision: '#f3f3f5'
    }[node.type];

    const borderColor = {
      screen: '#030213',
      action: '#717182',
      decision: '#717182'
    }[node.type];

    const borderWidth = node.type === 'screen' ? 2 : 1;

    return (
      <g key={node.id}>
        <rect
          x={node.position.x}
          y={node.position.y}
          width={node.size.width}
          height={node.size.height}
          fill={bgColor}
          stroke={borderColor}
          strokeWidth={borderWidth}
          rx="8"
        />
        <text
          x={node.position.x + node.size.width / 2}
          y={node.position.y + node.size.height / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-foreground text-sm font-medium"
        >
          {node.label.split('\n').map((line, i) => (
            <tspan key={i} x={node.position.x + node.size.width / 2} dy={i === 0 ? 0 : 16}>
              {line}
            </tspan>
          ))}
        </text>
      </g>
    );
  };

  return (
    <div className="w-full max-w-5xl mx-auto p-8">
      <div className="mb-8">
        <h1 className="mb-4">Ghost Sighting App - User Flow</h1>
        <p className="text-muted-foreground mb-6">
          This diagram shows the complete user journey through the ghost sighting reporting application.
        </p>
        
        {/* Legend */}
        <div className="flex flex-wrap gap-6 mb-8 p-4 bg-muted rounded-lg">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-white border-2 border-primary rounded"></div>
            <span className="text-sm">Main Screens</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-accent border border-muted-foreground rounded"></div>
            <span className="text-sm">Actions/Dialogs</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-0.5 bg-primary"></div>
            <span className="text-sm">Primary Flow</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-0.5 bg-muted-foreground"></div>
            <span className="text-sm">Navigation</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-0.5 bg-destructive"></div>
            <span className="text-sm">Back/Logout</span>
          </div>
        </div>
      </div>

      <div className="border border-border rounded-lg bg-card overflow-auto">
        <svg
          width="800"
          height="500"
          viewBox="0 0 800 500"
          className="w-full h-auto min-h-[500px]"
        >
          {/* Render connections first (so they appear behind nodes) */}
          {connections.map((connection, index) => renderConnection(connection, index))}
          
          {/* Render nodes */}
          {nodes.map(renderNode)}
          
          {/* Additional annotations */}
          <text x="400" y="30" textAnchor="middle" className="fill-muted-foreground text-sm">
            Entry Point
          </text>
          
          <text x="380" y="320" textAnchor="middle" className="fill-muted-foreground text-sm">
            Main Navigation Screens
          </text>
          
          {/* Navigation flow indicator */}
          <path
            d="M 50 380 Q 200 320 250 380 Q 350 320 450 380 Q 500 320 590 380"
            stroke="#717182"
            strokeWidth="1"
            fill="none"
            strokeDasharray="5,5"
            opacity="0.5"
          />
        </svg>
      </div>

      {/* Flow Description */}
      <div className="mt-8 grid md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h3>User Journey</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>User starts at <strong>Login Screen</strong></li>
            <li>After successful login, enters <strong>Main App</strong> with navigation</li>
            <li>Can navigate between three main screens using the navigation bar</li>
            <li><strong>Report Ghost</strong>: Submit new sightings</li>
            <li><strong>Browse Ghosts</strong>: View all reported sightings</li>
            <li><strong>User Profile</strong>: Manage personal sightings</li>
          </ul>
        </div>
        
        <div className="space-y-4">
          <h3>Key Features</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><strong>Profile Management</strong>: Edit and delete personal sightings</li>
            <li><strong>Persistent Navigation</strong>: Easy switching between screens</li>
            <li><strong>Secure Access</strong>: Login required for all functionality</li>
            <li><strong>Logout Option</strong>: Returns user to login screen</li>
          </ul>
        </div>
      </div>
    </div>
  );
}