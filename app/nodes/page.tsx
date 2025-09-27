'use client';

import { useState, useRef, useEffect } from 'react';

interface Node {
  id: string;
  x: number;
  y: number;
  text: string;
  level: number;
  parentId?: string;
  isClicked?: boolean;
}

export default function NodesPage() {
  const [nodes, setNodes] = useState<Node[]>([
    {
      id: 'root',
      x: 1000,
      y: 1000,
      text: 'Start',
      level: 0,
    }
  ]);
  const [connections, setConnections] = useState<{ from: string; to: string }[]>([]);
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [lastOffset, setLastOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isPhysicsEnabled, setIsPhysicsEnabled] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Center the canvas on the starting node when component mounts
  useEffect(() => {
    const centerCanvas = () => {
      if (containerRef.current) {
        // The starting node is at world coordinates (1000, 1000)
        // We need to center the viewport on this node
        const centerX = containerRef.current.clientWidth / 2;
        const centerY = containerRef.current.clientHeight / 2;
        
        // Calculate offset to center the starting node (1000, 1000) on screen
        const offsetX = centerX - 1000;
        const offsetY = centerY - 1000;
        
        console.log('Centering canvas, starting node at:', nodes[0], 'offset:', { x: offsetX, y: offsetY });
        setCanvasOffset({ x: offsetX, y: offsetY });
      }
    };

    // Center with a small delay to ensure container is rendered
    const timeoutId = setTimeout(centerCanvas, 100);
    
    // Also center on window resize
    window.addEventListener('resize', centerCanvas);
    
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', centerCanvas);
    };
  }, []);

  const generateNewNodes = (parentNode: Node) => {
    const newNodes: Node[] = [];
    const newConnections: { from: string; to: string }[] = [];
    
    // Generate 5 new nodes in a circle around the parent
    const angleStep = (2 * Math.PI) / 5;
    const radius = 300; // Increase radius for each level
    
    console.log(`Generating 5 nodes around parent ${parentNode.id} at (${parentNode.x}, ${parentNode.y})`);
    
    // Move the parent node further away from its parent (if it has one)
    if (parentNode.parentId) {
      const grandParent = nodes.find(n => n.id === parentNode.parentId);
      if (grandParent) {
        // Calculate the direction from grandparent to parent
        const dx = parentNode.x - grandParent.x;
        const dy = parentNode.y - grandParent.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 0) {
          // Double the distance by moving the parent further away
          const newX = grandParent.x + (dx / distance) * distance * 2;
          const newY = grandParent.y + (dy / distance) * distance * 2;
          
          // Update the parent node position
          setNodes(prev => prev.map(node => 
            node.id === parentNode.id 
              ? { ...node, x: newX, y: newY }
              : node
          ));
          
          console.log(`Moved parent node ${parentNode.id} from (${parentNode.x}, ${parentNode.y}) to (${newX}, ${newY})`);
          
          // Update parentNode reference for the rest of the function
          parentNode = { ...parentNode, x: newX, y: newY };
        }
      }
    }
    
    for (let i = 0; i < 5; i++) {
      const angle = i * angleStep;
      const x = parentNode.x + Math.cos(angle) * radius;
      const y = parentNode.y + Math.sin(angle) * radius;
      
      const newNode: Node = {
        id: `${parentNode.id}-${i}`,
        x,
        y,
        text: `Node ${i + 1}`,
        level: parentNode.level + 1,
        parentId: parentNode.id,
      };
      
      newNodes.push(newNode);
      newConnections.push({ from: parentNode.id, to: newNode.id });
      
      console.log(`Created node ${newNode.id} at (${x}, ${y})`);
    }
    
    console.log(`Total nodes created: ${newNodes.length}`);
    
    setNodes(prev => [...prev, ...newNodes]);
    setConnections(prev => [...prev, ...newConnections]);
  };

  const handleNodeClick = (node: Node, event: React.MouseEvent) => {
    // Prevent node click when dragging
    if (isDragging) return;
    
    // Mark the node as clicked
    setNodes(prev => prev.map(n => 
      n.id === node.id 
        ? { ...n, isClicked: true }
        : n
    ));
    
    // Only generate new nodes if this node doesn't have children yet
    const hasChildren = nodes.some(n => n.parentId === node.id);
    if (!hasChildren) {
      generateNewNodes(node);
    }
  };

  const handleMouseDown = (event: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: event.clientX, y: event.clientY });
    setLastOffset(canvasOffset);
  };

  const handleMouseMove = (event: React.MouseEvent) => {
    if (!isDragging) return;
    
    const deltaX = event.clientX - dragStart.x;
    const deltaY = event.clientY - dragStart.y;
    
    setCanvasOffset({
      x: lastOffset.x + deltaX,
      y: lastOffset.y + deltaY,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  const handleWheel = (event: React.WheelEvent) => {
    event.preventDefault();
    
    const delta = event.deltaY;
    const zoomFactor = 0.1;
    const newZoom = Math.max(0.1, Math.min(5, zoom + (delta > 0 ? -zoomFactor : zoomFactor)));
    
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;
      
      // Calculate the point under the mouse before zoom
      const worldX = (mouseX - canvasOffset.x) / zoom;
      const worldY = (mouseY - canvasOffset.y) / zoom;
      
      // Calculate new offset to keep the point under the mouse in the same place
      const newOffsetX = mouseX - worldX * newZoom;
      const newOffsetY = mouseY - worldY * newZoom;
      
      setZoom(newZoom);
      setCanvasOffset({ x: newOffsetX, y: newOffsetY });
    }
  };

  // Physics simulation for node repulsion
  const applyPhysics = () => {
    if (!isPhysicsEnabled) return;

    setNodes(prevNodes => {
      const newNodes = [...prevNodes];
      const normalRepulsionForce = 50000; // Normal repulsion strength
      const parentRepulsionForce = 500000; // Much stronger repulsion for parent nodes
      const damping = 0.9; // Damping factor to prevent oscillation
      const minDistance = 100; // Minimum distance between nodes
      const parentMinDistance = 200; // Larger minimum distance for parent nodes
      
      // Apply repulsion forces between all pairs of nodes
      for (let i = 0; i < newNodes.length; i++) {
        for (let j = i + 1; j < newNodes.length; j++) {
          const node1 = newNodes[i];
          const node2 = newNodes[j];
          
          const dx = node2.x - node1.x;
          const dy = node2.y - node1.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          // Check if either node is a parent (has children)
          const node1IsParent = prevNodes.some(n => n.parentId === node1.id);
          const node2IsParent = prevNodes.some(n => n.parentId === node2.id);
          const bothAreParents = node1IsParent && node2IsParent;
          
          // Use different parameters for parent nodes
          const repulsionForce = bothAreParents ? parentRepulsionForce : normalRepulsionForce;
          const effectiveMinDistance = bothAreParents ? parentMinDistance : minDistance;
          
          if (distance < effectiveMinDistance && distance > 0) {
            // Calculate repulsion force (inverse square law)
            const force = repulsionForce / (distance * distance);
            const fx = (dx / distance) * force;
            const fy = (dy / distance) * force;
            
            // Apply forces (with damping)
            newNodes[i] = {
              ...node1,
              x: node1.x - fx * damping,
              y: node1.y - fy * damping,
            };
            newNodes[j] = {
              ...node2,
              x: node2.x + fx * damping,
              y: node2.y + fy * damping,
            };
          }
        }
      }
      
      return newNodes;
    });
  };

  // Animation loop for physics
  useEffect(() => {
    const animate = () => {
      applyPhysics();
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    
    if (isPhysicsEnabled) {
      animationFrameRef.current = requestAnimationFrame(animate);
    }
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPhysicsEnabled]);

  return (
    <div className="min-h-screen bg-[#fff0d2] relative overflow-hidden">
      {/* Physics toggle button */}
      <button
        onClick={() => setIsPhysicsEnabled(!isPhysicsEnabled)}
        className="absolute top-4 right-4 z-10 px-4 py-2 bg-[#1e00ff] text-[#fff0d2] rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 text-sm font-medium"
      >
        Physics: {isPhysicsEnabled ? 'ON' : 'OFF'}
      </button>
      <div 
        ref={containerRef}
        className="w-full h-screen relative cursor-grab active:cursor-grabbing"
        style={{ width: '100vw', height: '100vh' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
      >
        {/* Infinite canvas container */}
        <div
          className="absolute"
          style={{
            transform: `translate(${canvasOffset.x}px, ${canvasOffset.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
            width: '200vw',
            height: '200vh',
            left: '0vw',
            top: '0vh',
          }}
        >
          
          {/* Render nodes */}
          {nodes.map((node) => (
            <div
              key={node.id}
              className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all duration-300 hover:scale-110"
              style={{
                left: node.x,
                top: node.y,
              }}
              onClick={(e) => handleNodeClick(node, e)}
            >
              <div
                className={`w-16 h-16 rounded-full text-[#fff0d2] flex items-center justify-center text-sm font-medium shadow-lg hover:shadow-xl transition-all duration-300 ${
                  node.isClicked ? 'bg-[#D2B48C]' : 'bg-[#1e00ff]'
                }`}
                style={{
                  animation: node.level === 0 ? 'none' : 'nodeAppear 0.5s ease-out',
                }}
              >
                {node.text}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      <style jsx>{`
        @keyframes nodeAppear {
          0% {
            opacity: 0;
            transform: scale(0);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}