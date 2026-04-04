import { useAuth } from '../context/AuthContext';

export default function PostCard({ post, onDelete }) {
  const { user } = useAuth();
  const isOwner = user && user.id === post.author_id;
  const date = new Date(post.created_at).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <article className="post-card">
      <h2 className="post-card-title">{post.title}</h2>
      <div className="post-card-meta">
        <span>By {post.author_name}</span>
        <span>{date}</span>
      </div>
      <p className="post-card-body">{post.body}</p>
      {isOwner && (
        <div className="post-card-actions">
          <button onClick={() => onDelete(post.id)} className="btn btn-danger btn-sm">Delete</button>
        </div>
      )}
    </article>
  );
}
