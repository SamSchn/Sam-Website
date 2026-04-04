import { useState, useEffect } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import PostCard from '../components/PostCard';

export default function Posts() {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api.getPosts().then(setPosts).catch(() => {});
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const post = await api.createPost(title, body);
      setPosts([post, ...posts]);
      setTitle('');
      setBody('');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.deletePost(id);
      setPosts(posts.filter((p) => p.id !== id));
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="page posts-page">
      <h1>🌿 Jungle News</h1>

      {user && (
        <form className="create-form" onSubmit={handleCreate}>
          <h3>🐒 Share an update</h3>
          {error && <div className="form-error">{error}</div>}
          <input
            type="text"
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          <textarea
            placeholder="What's on your mind?"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            required
          />
          <button type="submit" className="btn btn-primary">Post</button>
        </form>
      )}

      <div className="posts-list">
        {posts.length === 0 && <p className="empty-state">The jungle is quiet... no news yet! 🌴</p>}
        {posts.map((post) => (
          <PostCard key={post.id} post={post} onDelete={handleDelete} />
        ))}
      </div>
    </div>
  );
}
